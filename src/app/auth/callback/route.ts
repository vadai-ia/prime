import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { homeFor, isRole } from "@/lib/auth/roles";

const OTP_TYPES: EmailOtpType[] = ["invite", "magiclink", "recovery", "email", "signup", "email_change"];

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/**
 * Intercambio de código (PKCE) o de token_hash (templates de correo) por sesión.
 * Los templates en supabase/templates apuntan aquí con token_hash + type.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const typeParam = params.get("type");
  const type = OTP_TYPES.includes(typeParam as EmailOtpType) ? (typeParam as EmailOtpType) : null;
  const next = safeNext(params.get("next"));

  const supabase = await createClient();

  let failed = true;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = !!error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    failed = !!error;
  }

  if (failed) redirect("/login?error=enlace");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;

  if (!isRole(role)) {
    await supabase.auth.signOut();
    redirect("/login?error=sin-rol");
  }

  if (type === "invite" || type === "recovery") redirect("/cuenta/password");
  redirect(next ?? homeFor(role));
}
