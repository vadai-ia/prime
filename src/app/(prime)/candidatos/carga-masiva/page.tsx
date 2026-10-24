import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { listProfiles } from "@/lib/queries/profiles";
import { aiEnabled } from "@/lib/ai/client";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { BulkUpload } from "./bulk-upload";

export const metadata: Metadata = { title: "Carga masiva de CV · Prime HR Innovation" };

/** Varios CV a la vez para una vacante: la IA lee los datos de contacto, el reclutador revisa y da de alta. */
export default async function CargaMasivaPage(props: PageProps<"/candidatos/carga-masiva">) {
  await requireStaff();
  const sp = await props.searchParams;
  const profiles = (await listProfiles()).filter((p) => p.status !== "closed");
  const requested = typeof sp.profile === "string" ? sp.profile : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        backHref="/candidatos"
        title="Carga masiva de CV"
        subtitle="Elige la vacante y suelta los PDF. La IA lee nombre, teléfono y datos de contacto; revisa la tabla y da de alta a todos de una vez."
      />
      {profiles.length === 0 ? (
        <EmptyState
          title="Sin vacantes abiertas"
          hint="Un candidato siempre se postula a una vacante. Crea la primera desde un levantamiento."
          action={<ButtonLink href="/perfiles/levantamiento">Nuevo levantamiento</ButtonLink>}
        />
      ) : (
        <BulkUpload
          profiles={profiles.map((p) => ({ id: p.id, label: `${p.title} · ${p.client_name}` }))}
          defaultProfileId={profiles.some((p) => p.id === requested) ? requested : undefined}
          withAi={aiEnabled()}
        />
      )}
    </div>
  );
}
