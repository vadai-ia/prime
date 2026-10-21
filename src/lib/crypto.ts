import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Cifrado de tokens de integraciones (user_integrations) con AES-256-GCM.
// ENCRYPTION_KEY: 32 bytes en base64 (`openssl rand -base64 32`). Si cambia, los tokens guardados ya
// no se pueden leer y cada reclutador tiene que volver a conectar su cuenta.

const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("Falta ENCRYPTION_KEY en el servidor");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY debe ser de 32 bytes en base64");
  return buf;
}

export function encryptionEnabled(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}

/** "v1.<iv>.<tag>.<cifrado>" en base64url. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Token cifrado con un formato desconocido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
