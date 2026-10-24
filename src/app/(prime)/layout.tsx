import { getCurrentUser, requireStaff, touchLastSeen } from "@/lib/dal";
import { listMyNotifications } from "@/lib/queries/notifications";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { cookies } from "next/headers";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

const NAV = [
  { href: "/tablero", label: "Tablero" },
  { href: "/clientes", label: "Clientes" },
  { href: "/perfiles", label: "Vacantes" },
  { href: "/candidatos", label: "Candidatos" },
  { href: "/entrevistas", label: "Entrevistas" },
  { href: "/reportes", label: "Reportes" },
];

/**
 * Layout del equipo Prime. requireStaff aquí es una primera barrera; cada
 * página y query vuelve a verificar (los layouts no se re-renderizan al navegar).
 */
export default async function PrimeLayout({ children }: LayoutProps<"/">) {
  const session = await requireStaff();
  const [user, notifications, cookieStore] = await Promise.all([getCurrentUser(), listMyNotifications(), cookies()]);
  await touchLastSeen(user);
  const items = session.role === "admin" ? [...NAV, { href: "/configuracion", label: "Configuración" }] : NAV;
  const bell = <NotificationBell items={notifications.items} unread={notifications.unread} />;

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar
        items={items}
        bell={bell}
        userName={user.full_name || user.email}
        userRole={ROLE_LABELS[session.role]}
        initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          items={items}
          bell={bell}
          userName={user.full_name || user.email}
          userRole={ROLE_LABELS[session.role]}
        />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
