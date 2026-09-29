import { NextResponse, type NextRequest } from "next/server";
import { assertStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/uploads";
import { clientIp } from "@/lib/request";
import { MOCK_PIPELINE as MOCK } from "@/lib/mock";

/** Abre el PDF del reporte psicométrico vigente de la postulación. Misma regla que los documentos: RLS, bitácora y URL firmada de 60 s. */
export async function GET(req: NextRequest, ctx: RouteContext<"/candidatos/[applicationId]/psicometrico">) {
  try {
    await assertStaff();
  } catch {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (MOCK) return new NextResponse("Modo demo (MOCK_DATA): los psicométricos de demo no tienen archivo.", { status: 404 });

  const { applicationId } = await ctx.params;
  const supabase = await createClient();
  const { data: test } = await supabase
    .from("psychometric_tests")
    .select("id, report_file_path")
    .eq("application_id", applicationId)
    .not("report_file_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!test?.report_file_path) return new NextResponse("Esta postulación no tiene reporte psicométrico", { status: 404 });

  const url = await signedUrl("psychometrics", test.report_file_path);
  if (!url) return new NextResponse("No se pudo abrir el reporte", { status: 502 });

  await supabase.rpc("log_audit", {
    p_action: "view_psych_report",
    p_entity_type: "psychometric_test",
    p_entity_id: test.id,
    p_ip: clientIp(req),
  });
  return NextResponse.redirect(url);
}
