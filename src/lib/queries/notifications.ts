import "server-only";
import { verifySession } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/db/types";

export type NotificationRow = Pick<Tables<"notifications">, "id" | "kind" | "title" | "body" | "href" | "read_at" | "created_at">;

/** Campana del menú: las últimas notificaciones propias y cuántas faltan por leer. RLS deja ver solo las del usuario. */
export async function listMyNotifications(limit = 12): Promise<{ items: NotificationRow[]; unread: number }> {
  const session = await verifySession();
  const supabase = await createClient();
  const [items, unread] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session.userId).is("read_at", null),
  ]);
  if (items.error) throw items.error;
  return { items: items.data, unread: unread.count ?? 0 };
}
