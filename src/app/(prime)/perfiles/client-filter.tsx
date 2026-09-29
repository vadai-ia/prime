"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Select de cliente en Vacantes: cambia ?client= en la URL y conserva el filtro de estado. */
export function ClientFilter({ clients, value }: { clients: { id: string; name: string }[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("client", next);
    else params.delete("client");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => change(e.target.value)}
      aria-label="Cliente"
      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink shadow-sm outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25"
    >
      <option value="">Todos los clientes</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
