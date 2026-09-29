import "server-only";
import { requireAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import type { IntegrationStatus, WaTemplate } from "./types";

export async function listWaTemplates(): Promise<WaTemplate[]> {
  await requireAdmin();
  if (MOCK) return mock.waTemplates;
  const supabase = await createClient();
  const { data, error } = await supabase.from("wa_templates").select("*").order("name");
  if (error) throw error;
  return data;
}

/** Estado de integraciones según variables de entorno (sin llamar a nada externo). */
export async function getIntegrationsStatus(): Promise<IntegrationStatus[]> {
  await requireAdmin();
  const has = (...keys: string[]) => keys.every((k) => !!process.env[k]);
  return [
    { key: "supabase", label: "Supabase", configured: has("NEXT_PUBLIC_SUPABASE_URL"), detail: MOCK ? "Vistas en modo demo (MOCK_DATA=1)" : "Base de datos, Auth y Storage" },
    { key: "anthropic", label: "Anthropic (Claude)", configured: has("ANTHROPIC_API_KEY"), detail: "Perfil, score de CV, prefiltro, entrevistas, psicométrico, documentos" },
    { key: "whaapy", label: "Whaapy (WhatsApp)", configured: has("WHAAPY_API_KEY", "WHAAPY_WEBHOOK_SECRET"), detail: process.env.WHAAPY_PHONE_E164 ? `Número ${process.env.WHAAPY_PHONE_E164}` : "Número de Prime sin configurar" },
    { key: "fireflies", label: "Fireflies", configured: has("FIREFLIES_API_KEY"), detail: "Transcripción de entrevistas" },
    { key: "google", label: "Google Calendar y Meet", configured: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"), detail: "Cada reclutador conecta su calendario desde su perfil" },
    { key: "resend", label: "Resend (correo)", configured: has("RESEND_API_KEY", "RESEND_FROM"), detail: process.env.RESEND_FROM ? `Remitente ${process.env.RESEND_FROM}` : "Dominio de Prime sin verificar" },
  ];
}
