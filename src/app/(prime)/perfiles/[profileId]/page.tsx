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
import { CorrelateButton, Sugeridos } from "@/components/profile/sugeridos";
import { listProfileSuggestions } from "@/lib/queries/suggestions";
import { PROFILE_STATUS_LABELS, PROFILE_STATUS_TONES } from "@/lib/labels";

export const metadata: Metadata = { title: "Perfil · Prime HR Innovation" };
// "Buscar candidatos de otras vacantes" califica con la IA al responder (actions/suggestions.ts).
export const maxDuration = 60;

export default async function PerfilDetailPage(props: PageProps<"/perfiles/[profileId]">) {
  const session = await requireStaff();
  const { profileId } = await props.params;
  const search = await props.searchParams;
  const tab = typeof search.tab === "string" ? search.tab : undefined;
  const searching = typeof search.buscando === "string" ? Number(search.buscando) || null : null;
  const profile = await getProfile(profileId);
  if (!profile) notFound();
  // La asignación solo la ve y la cambia un admin; para el reclutador esta pestaña no existe.
  // Los sugeridos de otras vacantes también son solo admin (plan §12.25).
  const canSuggest = can(session.role, "suggest_candidates");
  const [team, rows, suggestions] = await Promise.all([
    can(session.role, "manage_assignments") ? getProfileRecruiters(profileId) : null,
    listPipeline({ profileId, includeDiscarded: true }),
    canSuggest ? listProfileSuggestions(profileId) : null,
  ]);
  const suggestBlocked = !aiEnabled()
    ? "La IA no está configurada (falta ANTHROPIC_API_KEY)."
    : profile.status === "closed"
      ? "La vacante está cerrada."
      : !profile.ai_config
        ? "Primero genera la evaluación de IA (pestaña Evaluación IA): sin criterios del CV no hay con qué comparar."
        : null;
  const openSuggestions = suggestions?.filter((s) => s.status !== "added").length ?? 0;
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
            {canSuggest && <CorrelateButton profileId={profile.id} disabledReason={suggestBlocked} />}
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
        key={`${tab ?? ""}${searching ?? ""}`}
        initial={tab}
        items={[
          { key: "descriptivo", label: "Descriptivo", content: <Descriptivo profile={profile} channels={channels} /> },
          { key: "ia", label: "Evaluación IA", badge: profile.ai_config ? `v${profile.ai_config.version}` : "sin config", content: <EvaluacionIA config={profile.ai_config} profileId={profile.id} aiOn={aiEnabled()} /> },
          { key: "levantamiento", label: "Levantamiento", badge: profile.intake ? (profile.intake.status === "generated" ? "generado" : "borrador") : undefined, content: <Levantamiento intake={profile.intake} /> },
          ...(suggestions
            ? [
                {
                  key: "sugeridos",
                  label: "Sugeridos",
                  badge: openSuggestions > 0 ? openSuggestions : undefined,
                  content: <Sugeridos profileId={profile.id} suggestions={suggestions} canSearch={!suggestBlocked} blockedReason={suggestBlocked} threshold={profile.ai_config?.cv_threshold ?? null} searchStartedAt={searching} />,
                },
              ]
            : []),
          ...(team ? [{ key: "reclutadores", label: "Reclutadores", badge: assignedCount > 0 ? assignedCount : "sin asignar", content: <Reclutadores profileId={profile.id} data={team} /> }] : []),
        ]}
      />
    </div>
  );
}
