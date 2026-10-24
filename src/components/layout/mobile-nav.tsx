"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { signOut } from "@/actions/auth";
import { ThemeToggle } from "./theme-toggle";

type Item = { href: string; label: string };

/** Barra superior en celular: la lateral solo existe de md para arriba. */
export function MobileNav({ items, bell, userName, userRole }: { items: Item[]; bell: ReactNode; userName: string; userRole: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="sticky top-0 z-30 bg-chrome text-white md:hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          className="inline-flex size-9 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
        {bell}
        <p className="ml-1 text-base font-semibold">Prime HR</p>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-white/15 px-3 pb-4 pt-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm transition ${isActive(item.href) ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"}`}
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-white/15 px-3 pt-3">
            <Link href="/mi-cuenta" onClick={() => setOpen(false)} className="min-w-0">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="text-xs text-white/60">{userRole} · Mi cuenta</p>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <ThemeToggle onChrome />
              <form action={signOut}>
                <button type="submit" className="text-xs text-white/70 hover:text-white hover:underline">
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
