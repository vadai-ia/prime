import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { listProfiles } from "@/lib/queries/profiles";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { CandidateForm } from "./candidate-form";

export const metadata: Metadata = { title: "Nuevo candidato · Prime HR Innovation" };

export default async function NuevoCandidatoPage(props: PageProps<"/candidatos/nuevo">) {
  await requireStaff();
  const sp = await props.searchParams;
  const profiles = (await listProfiles()).filter((p) => p.status !== "closed");
  const requested = typeof sp.profile === "string" ? sp.profile : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader backHref="/candidatos" title="Nuevo candidato" subtitle="Elige la vacante, sube el CV en PDF y revisa los datos antes de guardar." />
      {profiles.length === 0 ? (
        <EmptyState
          title="Sin vacantes abiertas"
          hint="Un candidato siempre se postula a una vacante. Crea la primera desde un levantamiento."
          action={<ButtonLink href="/perfiles/levantamiento">Nuevo levantamiento</ButtonLink>}
        />
      ) : (
        <Card>
          <CandidateForm
            profiles={profiles.map((p) => ({ id: p.id, label: `${p.title} · ${p.client_name}` }))}
            defaultProfileId={profiles.some((p) => p.id === requested) ? requested : undefined}
          />
        </Card>
      )}
    </div>
  );
}
