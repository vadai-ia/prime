"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Building2, CalendarDays, ChartColumn, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Users, type LucideIcon } from "lucide-react";
import { signOut } from "@/actions/auth";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";

const ICONS: Record<string, LucideIcon> = {
  "/tablero": LayoutDashboard,
  "/clientes": Building2,
  "/perfiles": BriefcaseBusiness,
  "/candidatos": Users,
  "/entrevistas": CalendarDays,
  "/reportes": ChartColumn,
  "/configuracion": Settings,
};

type Item = { href: string; label: string };

const navActiveClass = "bg-white/15 font-medium text-white shadow-[inset_3px_0_0_0_var(--lime)]";
const navInactiveClass = "text-white/75 hover:bg-white/10 hover:text-white";

/**
 * Menú lateral (de md para arriba), fijo a la altura de la pantalla. Se pliega a una barra de íconos;
 * la cuenta, el tema y Cerrar sesión van justo debajo del menú para no tener que bajar.
 */
export function Sidebar({ items, bell, userName, userRole, initialCollapsed }: { items: Item[]; bell: ReactNode; userName: string; userRole: string; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; SameSite=Lax`;
  }

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expandir menú" : "Plegar menú"}
      title={collapsed ? "Expandir menú" : "Plegar menú"}
      aria-expanded={!collapsed}
      className="inline-flex size-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <ToggleIcon className="size-5" aria-hidden />
    </button>
  );

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-linear-to-b from-chrome to-chrome-2 py-6 text-white transition-[width] duration-200 md:flex ${collapsed ? "w-16 items-center px-2" : "w-60 px-4"}`}
    >
      {collapsed ? (
        <div className="flex flex-col items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-lime text-base font-bold text-black" title="Prime HR">
            P
          </span>
          {toggleButton}
          {bell}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-1 px-2">
          <div className="min-w-0">
            <p className="text-base font-semibold">Prime HR</p>
            <p className="text-xs text-white/60">Reclutamiento</p>
          </div>
          <div className="flex items-center">
            {bell}
            {toggleButton}
          </div>
        </div>
      )}

      <nav className={`mt-8 flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
        {items.map((item) => {
          const Icon = ICONS[item.href] ?? LayoutDashboard;
          return (
            <NavLink
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-lg text-sm transition ${collapsed ? "size-10 justify-center" : "gap-2.5 px-3 py-2"}`}
              activeClassName={navActiveClass}
              inactiveClassName={navInactiveClass}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className={`mt-4 border-t border-white/15 pt-4 ${collapsed ? "flex w-full flex-col items-center gap-3" : "px-2"}`}>
        {collapsed ? (
          <>
            <Link
              href="/mi-cuenta"
              title={`${userName} · ${userRole} · Mi cuenta`}
              className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold transition hover:bg-white/25"
            >
              {userName.charAt(0).toUpperCase()}
            </Link>
            <ThemeToggle onChrome vertical />
            <form action={signOut}>
              <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className="inline-flex size-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white">
                <LogOut className="size-4.5" aria-hidden />
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/mi-cuenta" className="block rounded-lg hover:text-white/90" title="Mi cuenta: contraseña y conexión con Outlook">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="text-xs text-white/60">{userRole} · Mi cuenta</p>
            </Link>
            <div className="mt-3 flex items-center justify-between gap-2">
              <ThemeToggle onChrome />
              <form action={signOut}>
                <button type="submit" className="inline-flex items-center gap-1.5 text-xs text-white/70 underline-offset-2 hover:text-white hover:underline">
                  <LogOut className="size-3.5" aria-hidden />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
