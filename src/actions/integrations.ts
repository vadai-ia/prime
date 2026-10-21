"use server";

import { revalidatePath } from "next/cache";
import { assertStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

/** Desconectar Outlook: borra la fila propia (RLS). Las entrevistas ya creadas siguen en su calendario. */
export async function disconnectOutlook(): Promise<void> {
  const session = await assertStaff();
  const supabase = await createClient();
  await supabase.from("user_integrations").delete().eq("user_id", session.userId).eq("provider", "microsoft");
  revalidatePath("/mi-cuenta");
}
