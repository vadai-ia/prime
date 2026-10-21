import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { listPipeline } from "@/lib/queries/pipeline";
import { listProfiles } from "@/lib/queries/profiles";
import { listClients } from "@/lib/queries/clients";
import { CHANNEL_LABELS, STAGES, type Stage } from "@/lib/labels";
import type { SourceChannel } from "@/lib/queries/types";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Filters } from "@/components/pipeline/filters";
import { PipelineView } from "@/components/pipeline/pipeline-view";

export const metadata: Metadata = { title: "Candidatos · Prime HR Innovation" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function CandidatosPage(props: PageProps<"/candidatos">) {
  const session = await requireStaff();
  const sp = await props.searchParams;
  const profileId = str(sp.profile);
  const clientId = str(sp.client);
  const stageParam = str(sp.stage);
  const stage = STAGES.includes(stageParam as Stage) ? (stageParam as Stage) : undefined;
  const channelParam = str(sp.channel);
  const channel = channelParam && channelParam in CHANNEL_LABELS ? (channelParam as SourceChannel) : undefined;
  const search = str(sp.q);
  const view: "kanban" | "lista" = str(sp.view) === "lista" ? "lista" : "kanban";

  const [rows, profiles, clients] = await Promise.all([
    listPipeline({ profileId, clientId, stage, channel, search, includeDiscarded: stage === "discarded" }),
    listProfiles(),
    listClients(),
  ]);

  const viewHref = (v: "kanban" | "lista") => {
    const params = new URLSearchParams();
    if (clientId) params.set("client", clientId);
    if (profileId) params.set("profile", profileId);
    if (stage) params.set("stage", stage);
    if (channel) params.set("channel", channel);
    if (search) params.set("q", search);
    params.set("view", v);
    return `/candidatos?${params.toString()}`;
  };

  const toggle = (v: "kanban" | "lista", label: string) => (
    <Link
      href={viewHref(v)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === v ? "bg-surface text-forest shadow-sm" : "text-ink-muted hover:text-ink"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Candidatos"
        subtitle={`${rows.length} ${rows.length === 1 ? "postulación" : "postulaciones"}${stage ? "" : " activas"}`}
        actions={
          <>
            <div className="flex rounded-lg bg-canvas p-1">
              {toggle("kanban", "Kanban")}
              {toggle("lista", "Lista")}
            </div>
            {can(session.role, "view_blacklist") && (
              <ButtonLink href="/candidatos/lista-negra" variant="ghost">
                Lista negra
              </ButtonLink>
            )}
            <ButtonLink href={profileId ? `/candidatos/nuevo?profile=${profileId}` : "/candidatos/nuevo"}>Nuevo candidato</ButtonLink>
          </>
        }
      />
      <Filters values={{ profileId, clientId, stage, channel, search, view }} profiles={profiles} clients={clients} />
      <PipelineView rows={rows} view={view} stageFilter={stage} />
    </div>
  );
}
