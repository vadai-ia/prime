import { getCurrentUser, requireClient, touchLastSeen } from "@/lib/dal";
import { signOut } from "@/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navClass = "border-b-2 pb-0.5 transition";
const navActive = "border-forest font-medium text-forest";
const navInactive = "border-transparent text-ink hover:text-forest";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const session = await requireClient();
  const user = await getCurrentUser();
  await touchLastSeen(user);

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", session.clientId!)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-forest text-lg font-bold text-on-forest">{(client?.name ?? "C").charAt(0).toUpperCase()}</span>
            <div>
              <p className="text-sm font-semibold text-forest">{client?.name ?? "Cliente"} · Portal de reclutamiento</p>
              <p className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <ShieldCheck className="size-3.5 text-leaf" aria-hidden />
                Datos de candidatos protegidos conforme a la LFPDPPP · Prime HR Innovation
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink href="/portal" exact className={navClass} activeClassName={navActive} inactiveClassName={navInactive}>
              Inicio
            </NavLink>
            <NavLink href="/portal/candidatos" className={navClass} activeClassName={navActive} inactiveClassName={navInactive}>
              Candidatos
            </NavLink>
            <NavLink href="/portal/semanal" className={navClass} activeClassName={navActive} inactiveClassName={navInactive}>
              Reporte semanal
            </NavLink>
            <span className="text-line">|</span>
            <span className="text-ink-muted">{user.full_name || user.email}</span>
            <form action={signOut}>
              <button type="submit" className="text-ink-muted underline-offset-2 hover:text-forest hover:underline">
                Salir
              </button>
            </form>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
