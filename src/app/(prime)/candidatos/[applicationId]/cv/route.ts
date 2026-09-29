import { NextResponse, type NextRequest } from "next/server";
import { assertStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOCK_PIPELINE as MOCK } from "@/lib/mock";

/** Abre el CV del candidato: verifica que sea staff y redirige a una URL firmada de 60 s (el bucket `cvs` es privado). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/candidatos/[applicationId]/cv">) {
  try {
    await assertStaff();
  } catch {
    return new NextResponse("No autorizado", { status: 401 });
  }
  if (MOCK) return new NextResponse("Modo demo (MOCK_DATA): los candidatos de demo no tienen CV.", { status: 404 });

  const { applicationId } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("candidates(cv_file_path)").eq("id", applicationId).maybeSingle();
  const path = data?.candidates?.cv_file_path;
  if (!path) return new NextResponse("Este candidato no tiene CV", { status: 404 });

  const { data: signed, error } = await createAdminClient().storage.from("cvs").createSignedUrl(path, 60);
  if (error) return new NextResponse("No se pudo abrir el CV", { status: 502 });
  return NextResponse.redirect(signed.signedUrl);
}
