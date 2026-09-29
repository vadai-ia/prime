"use client";

import { useState } from "react";
import type { ClientSummary, ProfileSummary } from "@/lib/queries/types";

/** Cliente y vacante del filtro: al elegir cliente, la lista de vacantes se reduce a las suyas sin recargar. */
export function ClientProfileSelects({
  clients,
  profiles,
  clientId,
  profileId,
  className,
}: {
  clients: ClientSummary[];
  profiles: ProfileSummary[];
  clientId?: string;
  profileId?: string;
  className: string;
}) {
  const [client, setClient] = useState(clientId ?? "");
  const [profile, setProfile] = useState(profileId ?? "");
  const visibleProfiles = client ? profiles.filter((p) => p.client_id === client) : profiles;

  function changeClient(next: string) {
    setClient(next);
    // La vacante elegida deja de valer si es de otra empresa.
    if (next && !profiles.some((p) => p.id === profile && p.client_id === next)) setProfile("");
  }

  return (
    <>
      <select name="client" value={client} onChange={(e) => changeClient(e.target.value)} className={className} aria-label="Cliente">
        <option value="">Todos los clientes</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select name="profile" value={profile} onChange={(e) => setProfile(e.target.value)} className={className} aria-label="Vacante">
        <option value="">{client ? "Todas sus vacantes" : "Todas las vacantes"}</option>
        {visibleProfiles.map((p) => (
          <option key={p.id} value={p.id}>
            {client ? p.title : `${p.title} · ${p.client_name}`}
          </option>
        ))}
      </select>
    </>
  );
}
