import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Subidas desde el navegador sin pasar el archivo por Vercel (plan §12, Storage):
//   1. el servidor verifica permiso y da una URL firmada hacia uploads/{usuario}/…
//   2. el navegador sube directo a Storage
//   3. el servidor mueve el archivo a su carpeta definitiva y registra la fila
// Los buckets son privados y sin políticas: todo acceso pasa por aquí con service role,
// siempre DESPUÉS de comprobar con la sesión del usuario (RLS) que el candidato es suyo.

export type UploadTicket = { path: string; token: string } | { error: string };

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const uploadPrefix = (userId: string) => `uploads/${userId}/`;

/** El path viene del navegador: solo vale si está en la carpeta de subidas de quien lo manda. */
export const isOwnUpload = (path: string, userId: string) => path.startsWith(uploadPrefix(userId)) && /^[\w/-]+\.(pdf|jpg|png|webp)$/.test(path);

export async function createUploadTicket(bucket: string, userId: string, file: { size: number; type: string }, opts: { mimes: string[]; maxBytes: number }): Promise<UploadTicket> {
  const ext = EXT[file.type];
  if (!ext || !opts.mimes.includes(file.type)) return { error: opts.mimes.length === 1 ? "El archivo debe ser un PDF" : "El archivo debe ser PDF, JPG, PNG o WEBP" };
  if (!(file.size > 0 && file.size <= opts.maxBytes)) return { error: `El archivo no puede pesar más de ${Math.round(opts.maxBytes / 1024 / 1024)} MB` };

  const path = `${uploadPrefix(userId)}${randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error) return { error: error.message };
  return { path: data.path, token: data.token };
}

/** Mueve la subida a `{folder}/{uuid}.{ext}`. Devuelve el path final, o un error si el archivo no llegó. */
export async function moveUpload(bucket: string, uploadPath: string, folder: string): Promise<{ path: string } | { error: string }> {
  const ext = uploadPath.split(".").pop();
  const finalPath = `${folder}/${randomUUID()}.${ext}`;
  const { error } = await createAdminClient().storage.from(bucket).move(uploadPath, finalPath);
  if (error) return { error: "No se encontró el archivo subido. Vuelve a intentarlo." };
  return { path: finalPath };
}

export async function removeFile(bucket: string, path: string) {
  await createAdminClient().storage.from(bucket).remove([path]);
}

export async function signedUrl(bucket: string, path: string, seconds = 60): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
}
