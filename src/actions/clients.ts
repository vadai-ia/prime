"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin, UnauthorizedError } from "@/lib/dal";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { MOCK_CORE as MOCK, MOCK_WRITE_ERROR } from "@/lib/mock";

export type ClientFormState = { error?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Nombre de la empresa requerido"),
  industry: z.string().trim().optional(),
  city: z.string().trim().optional(),
  address: z.string().trim().optional(),
  contact_name: z.string().trim().optional(),
  contact_title: z.string().trim().optional(),
  contact_email: z.string().trim().email("Correo de contacto no válido").optional().or(z.literal("")),
  contact_phone: z.string().trim().optional(),
  client_since: z.string().optional(),
  daily_report_time: z.string().regex(/^\d{2}:\d{2}$/, "Hora no válida").default("18:00"),
  weekly_report_dow: z.coerce.number().int().min(0).max(6).default(5),
  portal_enabled: z.coerce.boolean().default(true),
});

/** Alta de cliente (solo admin). */
export async function createClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = schema.safeParse({ ...raw, portal_enabled: raw.portal_enabled === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const d = parsed.data;
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: d.name,
      industry: d.industry || null,
      city: d.city || null,
      address: d.address || null,
      contact_name: d.contact_name || null,
      contact_title: d.contact_title || null,
      contact_email: d.contact_email || null,
      contact_phone: d.contact_phone || null,
      client_since: d.client_since || null,
      daily_report_time: d.daily_report_time,
      weekly_report_dow: d.weekly_report_dow,
      portal_enabled: d.portal_enabled,
      report_recipients: d.contact_email ? [d.contact_email] : [],
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

const updateSchema = schema.extend({
  id: z.string().uuid("Cliente no válido"),
  is_active: z.coerce.boolean().default(true),
});

const emailList = z.array(z.string().email("Hay un correo no válido en los destinatarios"));
const splitEmails = (v: string | undefined) => (v ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

/** Edición de cliente (solo admin): los campos del alta, más destinatarios de reportes y baja. */
export async function updateClient(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  try {
    await assertAdmin();
  } catch (e) {
    return { error: e instanceof UnauthorizedError ? e.message : "No autorizado" };
  }
  if (MOCK) return { error: MOCK_WRITE_ERROR };

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = updateSchema.safeParse({ ...raw, portal_enabled: raw.portal_enabled === "on", is_active: raw.is_active === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
  const recipients = emailList.safeParse(splitEmails(raw.report_recipients));
  if (!recipients.success) return { error: recipients.error.issues[0]?.message ?? "Destinatarios no válidos" };

  const d = parsed.data;
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("clients")
    .update({
      name: d.name,
      industry: d.industry || null,
      city: d.city || null,
      address: d.address || null,
      contact_name: d.contact_name || null,
      contact_title: d.contact_title || null,
      contact_email: d.contact_email || null,
      contact_phone: d.contact_phone || null,
      client_since: d.client_since || null,
      daily_report_time: d.daily_report_time,
      weekly_report_dow: d.weekly_report_dow,
      portal_enabled: d.portal_enabled,
      is_active: d.is_active,
      report_recipients: recipients.data,
    })
    .eq("id", d.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Cliente no encontrado" };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${d.id}`);
  redirect(`/clientes/${d.id}`);
}
