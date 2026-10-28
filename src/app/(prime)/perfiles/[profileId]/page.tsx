import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { aiEnabled } from "@/lib/ai/client";
import { getProfile } from "@/lib/queries/profiles";
import { getProfileRecruiters } from "@/lib/queries/assignments";
import { listPipeline } from "@/lib/queries/pipeline";
import type { SourceChannel } from "@/lib/queries/types";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Stat } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { ButtonLink } from "@/components/ui/button";
import { Descriptivo } from "@/components/profile/descriptivo";
import { EvaluacionIA } from "@/components/profile/evaluacion-ia";
import { Levantamiento } from "@/components/profile/levantamiento";
import { Reclutadores } from "@/components/profile/reclutadores";
import { PROFILE_STATUS_LABELS, PROFILE_STATUS_TONES } from "@/lib/labels";

export const metadata: Metadata = { title: "Perfil · Prime HR Innovation" };

export default async function PerfilDetailPage(props: PageProps<"/perfiles/[profileId]">) {
  const session = await requireStaff();
  const { profileId } = await props.params;
  const profile = await getProfile(profileId);
  if (!profile) notFound();
  // La asignación solo la ve y la cambia un admin; para el reclutador esta pestaña no existe.
  const [team, rows] = await Promise.all([can(session.role, "manage_assignments") ? getProfileRecruiters(profileId) : null, listPipeline({ profileId, includeDiscarded: true })]);
  const channels: Partial<Record<SourceChannel, number>> = {};
  for (const r of rows) if (r.source_channel) channels[r.source_channel] = (channels[r.source_channel] ?? 0) + 1;
  const assignedCount = team?.recruiters.filter((r) => r.assigned).length ?? 0;

  const c = profile.counts;
  const inProcess = c.prefilter + c.cv_review + c.prime_interview + c.psychometric + c.documents + c.client_interview;
  const total = inProcess + c.new + c.hired + c.discarded;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        backHref="/perfiles"
        title={profile.title}
        subtitle={
          <>
            <Link href={`/clientes/${profile.client_id}`} className="hover:text-forest">
              {profile.client_name}
            </Link>
            {profile.work_zone && <> · {profile.work_zone}</>} · {profile.openings} {profile.openings === 1 ? "plaza" : "plazas"}
          </>
        }
        actions={
          <>
            <Pill tone={PROFILE_STATUS_TONES[profile.status]}>{PROFILE_STATUS_LABELS[profile.status]}</Pill>
            <ButtonLink href={`/perfiles/${profile.id}/editar`} variant="secondary">
              Editar
            </ButtonLink>
            <ButtonLink href={`/candidatos?profile=${profile.id}`} variant="secondary">
              Ver candidatos
            </ButtonLink>
            {profile.status !== "closed" && (
              <>
                <ButtonLink href={`/candidatos/carga-masiva?profile=${profile.id}`} variant="secondary">
                  Cargar CVs
                </ButtonLink>
                <ButtonLink href={`/candidatos/nuevo?profile=${profile.id}`}>Agregar candidato</ButtonLink>
              </>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Postulantes" value={total} />
        <Stat label="En proceso" value={inProcess} tone="forest" />
        <Stat label="Entrevista Prime" value={c.prime_interview} tone="amber" />
        <Stat label="Con cliente" value={c.client_interview} tone="forest" />
        <Stat label="Contratados" value={c.hired} tone="leaf" hint={`de ${profile.openings} ${profile.openings === 1 ? "plaza" : "plazas"}`} />
        <Stat label="Descartados" value={c.discarded} tone="danger" />
      </div>

      <Tabs
        items={[
          { key: "descriptivo", label: "Descriptivo", content: <Descriptivo profile={profile} channels={channels} /> },
          { key: "ia", label: "Evaluación IA", badge: profile.ai_config ? `v${profile.ai_config.version}` : "sin config", content: <EvaluacionIA config={profile.ai_config} profileId={profile.id} aiOn={aiEnabled()} /> },
          { key: "levantamiento", label: "Levantamiento", badge: profile.intake ? (profile.intake.status === "generated" ? "generado" : "borrador") : undefined, content: <Levantamiento intake={profile.intake} /> },
          ...(team ? [{ key: "reclutadores", label: "Reclutadores", badge: assignedCount > 0 ? assignedCount : "sin asignar", content: <Reclutadores profileId={profile.id} data={team} /> }] : []),
        ]}
      />
    </div>
  );
}
