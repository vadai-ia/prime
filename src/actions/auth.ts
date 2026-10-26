"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/dal";
import { homeFor, isRole } from "@/lib/auth/roles";

export type AuthFormState = { error?: string; message?: string; resetEmail?: string } | undefined;

const credentialsSchema = z.object({
  email: z.string().trim().email("Correo no válido"),
  password: z.string().min(8, "La contraseña tiene al menos 8 caracteres"),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "La contraseña tiene al menos 8 caracteres"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

function safeNext(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/** Staff: correo + contraseña. */
export async function signInWithPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return explainFailedLogin(parsed.data.email);

  const role = data.user.app_metadata?.role;
  if (!isRole(role)) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no tiene un rol asignado. Pide a un administrador que la active." };
  }

  redirect(safeNext(formData.get("next")) ?? homeFor(role));
}

/**
 * Login fallido: dice si el correo existe y qué hacer según su rol (decisión del 26 oct, plan §2.2).
 * Admin: puede pedir el correo de recuperación. Reclutador y cliente: se lo pide a un admin, que
 * la restablece desde Configuración. Lee public.users con service role porque aún no hay sesión;
 * solo el rol y si está activa.
 */
async function lookupAccount(email: string) {
  const { data } = await createAdminClient().from("users").select("role, is_active").eq("email", email.toLowerCase()).maybeSingle();
  return data;
}

async function explainFailedLogin(email: string): Promise<AuthFormState> {
  const account = await lookupAccount(email);
  if (!account) return { error: "No hay una cuenta con ese correo." };
  if (!account.is_active) return { error: "Tu cuenta está desactivada. Habla con un administrador de Prime." };
  if (account.role === "admin") return { error: "Contraseña incorrecta.", resetEmail: email };
  return { error: "Contraseña incorrecta. Pide a un administrador que te pase o te reinicie tu contraseña." };
}

/** "Olvidé mi contraseña": solo para admins. Supabase manda el enlace, que entra por /auth/callback a /cuenta/password. */
export async function requestPasswordReset(email: string): Promise<AuthFormState> {
  const parsed = z.string().trim().email("Correo no válido").safeParse(email);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Correo no válido" };

  const account = await lookupAccount(parsed.data);
  if (!account || !account.is_active || account.role !== "admin") {
    return { error: "Pide a un administrador que te pase o te reinicie tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/cuenta/password")}`,
  });
  if (error) return { error: "No se pudo mandar el correo: " + error.message, resetEmail: parsed.data };
  return { message: `Te mandamos un enlace a ${parsed.data} para definir una contraseña nueva. Revisa también el spam.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Invitado o recuperación: define contraseña y entra. */
export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const session = await verifySession();

  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "No se pudo guardar la contraseña: " + error.message };

  redirect(homeFor(session.role));
}
