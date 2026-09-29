"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/dal";
import { homeFor, isRole } from "@/lib/auth/roles";

export type AuthFormState = { error?: string } | undefined;

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
  if (error || !data.user) return { error: "Correo o contraseña incorrectos" };

  const role = data.user.app_metadata?.role;
  if (!isRole(role)) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no tiene un rol asignado. Pide a un administrador que la active." };
  }

  redirect(safeNext(formData.get("next")) ?? homeFor(role));
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
