"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, UnauthorizedError } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/auth/roles";

export type UserFormState = { error?: string; ok?: boolean; message?: string } | undefined;

const baseSchema = z
  .object({
    email: z.string().trim().email("Correo no válido"),
    full_name: z.string().trim().min(2, "Nombre requerido"),
    role: z.enum(ROLES),
    client_id: z.string().uuid().nullable(),
    mode: z.enum(["password", "invite"]).default("password"),
    password: z.string().min(8, "La contraseña temporal tiene al menos 8 caracteres").optional().or(z.literal("")),
  })
  .refine((v) => (v.role === "client") === (v.client_id !== null), {
    message: "Un usuario cliente necesita empresa; el staff no lleva empresa",
    path: ["client_id"],
  })
  .refine((v) => v.mode === "invite" || (v.password && v.password.length >= 8), {
    message: "Escribe una contraseña temporal de al menos 8 caracteres",
    path: ["password"],
  });

/**
 * Alta de usuario por el admin (plan §2.2). Dos modos:
 * - password: se crea confirmado con una contraseña temporal que el admin comunica; no requiere correo.
 * - invite: Supabase manda el correo de invitación y la persona define su contraseña en /cuenta/password.
 * En ambos, role y client_id van en app_metadata; el trigger de auth.users crea el espejo en public.users.
 */
export async function createUserAccount(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }

  const rawClient = formData.get("client_id");
  const parsed = baseSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    client_id: typeof rawClient === "string" && rawClient !== "" ? rawClient : null,
    mode: formData.get("mode") ?? "password",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const { email, full_name, role, client_id, mode, password } = parsed.data;
  const app_metadata = { role, client_id };
  const admin = createAdminClient();

  if (mode === "password") {
    const { error } = await admin.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      app_metadata,
      user_metadata: { full_name },
    });
    if (error) return { error: "No se pudo crear la cuenta: " + error.message };
    revalidatePath("/configuracion");
    return { ok: true, message: `Cuenta creada. Comparte la contraseña temporal con ${full_name}; puede cambiarla en su perfil.` };
  }

  // inviteUserByEmail solo escribe user_metadata: primero invita, luego fija el rol con service role.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/cuenta/password")}`,
  });
  if (error || !data.user) return { error: "No se pudo invitar: " + (error?.message ?? "sin respuesta") };

  const { error: metaError } = await admin.auth.admin.updateUserById(data.user.id, { app_metadata });
  if (metaError) return { error: "Invitación enviada pero no se pudo asignar el rol: " + metaError.message };

  revalidatePath("/configuracion");
  return { ok: true, message: "Invitación enviada por correo." };
}

/**
 * Activar o desactivar. Además de is_active, banea en Auth para que el JWT
 * no se pueda refrescar (la sesión vigente caduca en una hora como máximo).
 * Al desactivar, la base saca al usuario de todas sus vacantes y reparte sus
 * candidatos en proceso (migraciones 0014 y 0015); un desactivado ya no ve nada.
 */
export async function setUserActive(userId: string, active: boolean): Promise<UserFormState> {
  let session;
  try {
    session = await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (session.userId === userId && !active) return { error: "No puedes desactivar tu propia cuenta" };

  const admin = createAdminClient();

  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876600h",
  });
  if (banError) return { error: banError.message };

  // Con la sesión del admin (no service role) para que el historial de asignaciones registre quién lo hizo.
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ is_active: active }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/configuracion");
  revalidatePath("/perfiles");
  return { ok: true };
}

/**
 * Corregir el nombre de alguien (cuentas creadas desde el dashboard de Supabase llegan sin nombre).
 * Va a los dos lados: user_metadata en Auth y el espejo public.users, porque el trigger de
 * sincronización solo copia el nombre al crear la fila.
 */
export async function setUserName(userId: string, fullName: string): Promise<UserFormState> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  const parsed = z.object({ userId: z.string().uuid(), name: z.string().trim().min(2, "Nombre requerido").max(120) }).safeParse({ userId, name: fullName });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const { error: authError } = await createAdminClient().auth.admin.updateUserById(parsed.data.userId, { user_metadata: { full_name: parsed.data.name } });
  if (authError) return { error: authError.message };

  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ full_name: parsed.data.name }).eq("id", parsed.data.userId);
  if (error) return { error: error.message };

  revalidatePath("/configuracion");
  revalidatePath("/perfiles");
  return { ok: true };
}

/**
 * Cambio de rol o de empresa de un reclutador o un usuario cliente (Configuración → Ver). Nunca el de
 * otro admin ni el propio. Va por app_metadata; el trigger sincroniza el espejo public.users. Si deja
 * de ser reclutador, la base lo saca de todas sus vacantes y reparte sus candidatos en proceso
 * (users_release_assignments, 0014/0015), como al desactivarlo. La sesión abierta de esa persona toma el rol nuevo al refrescarse (hasta 1 h).
 */
export async function setUserRole(
  userId: string,
  role: (typeof ROLES)[number],
  clientId: string | null,
): Promise<UserFormState> {
  let session;
  try {
    session = await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (session.userId === userId) return { error: "No puedes cambiar tu propio rol" };
  if ((role === "client") !== (clientId !== null)) {
    return { error: "Un usuario cliente necesita empresa; el staff no lleva empresa" };
  }

  const supabase = await createClient();
  const { data: target } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "admin") return { error: "El rol de otro administrador no se cambia aquí" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { role, client_id: clientId },
  });
  if (error) return { error: error.message };

  revalidatePath("/configuracion");
  revalidatePath("/perfiles");
  return { ok: true, message: "Rol actualizado." };
}

/**
 * Restablecer la contraseña de un reclutador o de un usuario cliente desde Configuración (sin correo):
 * el admin pone una temporal y se la pasa. La de otro admin no: él la recupera por correo desde el login.
 */
export async function resetUserPassword(userId: string, password: string): Promise<UserFormState> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (password.length < 8) return { error: "La contraseña tiene al menos 8 caracteres" };

  const supabase = await createClient();
  const { data: target } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "admin") return { error: "La contraseña de un administrador no se cambia aquí: la recupera él desde el login con “Olvidé mi contraseña”." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return { error: error.message };
  return { ok: true, message: "Contraseña actualizada." };
}
