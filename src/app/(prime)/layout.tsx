import { getCurrentUser, requireStaff, touchLastSeen } from "@/lib/dal";
import { listMyNotifications } from "@/lib/queries/notifications";
import { NotificationBell } from "@/components/layout/notification-bell";
import { signOut } from "@/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { NavLink } from "@/components/layout/nav-link";

const NAV = [
  { href: "/tablero", label: "Tablero" },
  { href: "/clientes", label: "Clientes" },
  { href: "/perfiles", label: "Vacantes" },
  { href: "/candidatos", label: "Candidatos" },
  { href: "/entrevistas", label: "Entrevistas" },
  { href: "/reportes", label: "Reportes" },
];

const navLinkClass = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition";
const navActiveClass = "bg-white/15 font-medium text-white shadow-[inset_3px_0_0_0_var(--leaf)]";
const navInactiveClass = "text-white/75 hover:bg-white/10 hover:text-white";

/**
 * Layout del equipo Prime. requireStaff aquí es una primera barrera; cada
 * página y query vuelve a verificar (los layouts no se re-renderizan al navegar).
 */
export default async function PrimeLayout({ children }: LayoutProps<"/">) {
  const session = await requireStaff();
  const [user, notifications] = await Promise.all([getCurrentUser(), listMyNotifications()]);
  await touchLastSeen(user);

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-60 shrink-0 flex-col bg-linear-to-b from-forest to-forest-2 px-4 py-6 text-white md:flex">
        <div className="flex items-start justify-between gap-2 px-2">
          <div>
            <p className="text-base font-semibold">Prime HR</p>
            <p className="text-xs text-white/60">Reclutamiento</p>
          </div>
          <NotificationBell items={notifications.items} unread={notifications.unread} />
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href} className={navLinkClass} activeClassName={navActiveClass} inactiveClassName={navInactiveClass}>
              {item.label}
            </NavLink>
          ))}
          {session.role === "admin" && (
            <NavLink href="/configuracion" className={navLinkClass} activeClassName={navActiveClass} inactiveClassName={navInactiveClass}>
              Configuración
            </NavLink>
          )}
        </nav>
        <div className="mt-auto border-t border-white/15 px-2 pt-4">
          <p className="truncate text-sm font-medium">{user.full_name || user.email}</p>
          <p className="text-xs text-white/60">{ROLE_LABELS[session.role]}</p>
          <form action={signOut}>
            <button type="submit" className="mt-3 text-xs text-white/70 underline-offset-2 hover:text-white hover:underline">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
