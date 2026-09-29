"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifySession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

const idsSchema = z.array(z.string().uuid()).max(100).optional();

/** Marca como leídas las notificaciones propias (todas si no llegan ids). La RPC solo toca las del usuario. */
export async function markNotificationsRead(ids?: string[]): Promise<{ error?: string }> {
  await verifySession();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { error: "Notificación no válida" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", parsed.data ? { p_ids: parsed.data } : {});
  if (error) return { error: "No se pudieron marcar como leídas" };
  revalidatePath("/", "layout");
  return {};
}
