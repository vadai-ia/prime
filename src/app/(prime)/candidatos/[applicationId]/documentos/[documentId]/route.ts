import { NextResponse, type NextRequest } from "next/server";
import { assertStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/uploads";
import { clientIp } from "@/lib/request";
import { MOCK_PIPELINE as MOCK } from "@/lib/mock";

/**
 * Abre un documento del expediente (INE, CURP, constancia…). El bucket es privado: se lee la fila con la
 * sesión del usuario (RLS decide si el candidato es suyo), se registra en audit_log y se redirige a una URL firmada de 60 s.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/candidatos/[applicationId]/documentos/[documentId]">) {
  try {
    await assertStaff();
  } catch {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (MOCK) return new NextResponse("Modo demo (MOCK_DATA): los documentos de demo no tienen archivo.", { status: 404 });

  const { documentId } = await ctx.params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("candidate_documents").select("id, file_path").eq("id", documentId).maybeSingle();
  if (!doc?.file_path) return new NextResponse("Documento no encontrado", { status: 404 });

  const url = await signedUrl("documents", doc.file_path);
  if (!url) return new NextResponse("No se pudo abrir el documento", { status: 502 });

  await supabase.rpc("log_audit", {
    p_action: "view_document",
    p_entity_type: "candidate_document",
    p_entity_id: doc.id,
    p_ip: clientIp(req),
  });
  return NextResponse.redirect(url);
}
