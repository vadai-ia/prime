import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { listClients } from "@/lib/queries/clients";
import { listProfiles } from "@/lib/queries/profiles";
import { getChannels, getDiscardReasons, getFunnel, getPrefilterFailures, getStageDurations, listInsights, listReportRuns } from "@/lib/queries/reports";
import { ReportFilters } from "./filters";
import { aggregateChannels, aggregateDiscards, aggregateDurations, aggregateFunnel, aggregatePrefilter } from "./aggregate";
import { CanalesSection, CorreosSection, DescartesSection, EmbudoSection, InsightsSection, PrefiltroSection, TiemposSection } from "./sections";
import { EmailPreviewSection } from "./email-content";
import { EMAIL_KINDS, type EmailKind } from "./email-preview";

export const metadata: Metadata = { title: "Reportes · Prime HR Innovation" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function ReportesPage(props: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  const sp = await props.searchParams;
  const clientId = one(sp.client);
  const profileId = one(sp.profile);
  const filters = { clientId, profileId };
  const correo = one(sp.correo);
  const emailKind: EmailKind = EMAIL_KINDS.find((k) => k.key === correo)?.key ?? "interno";

  const [clients, profiles, funnelRows, channelRows, durationRows, discardRows, prefilterRows, runs, insights] = await Promise.all([
    listClients({ includeInactive: true }),
    listProfiles(clientId ? { clientId } : {}),
    getFunnel(filters),
    getChannels(filters),
    getStageDurations(filters),
    getDiscardReasons(filters),
    getPrefilterFailures(filters),
    listReportRuns(30),
    session.role === "admin" ? listInsights() : Promise.resolve([]),
  ]);

  const funnel = aggregateFunnel(funnelRows);
  const channels = aggregateChannels(channelRows);
  const durations = aggregateDurations(durationRows);
  const discards = aggregateDiscards(discardRows);
  const prefilter = aggregatePrefilter(prefilterRows);

  const scope = [clients.find((c) => c.id === clientId)?.name, profiles.find((p) => p.id === profileId)?.title].filter(Boolean).join(" · ");

  const tabs = [
    { key: "embudo", label: "Embudo", content: <EmbudoSection stages={funnel.stages} discarded={funnel.discarded} /> },
    { key: "canales", label: "Canales", content: <CanalesSection channels={channels} /> },
    { key: "tiempos", label: "Tiempos por etapa", content: <TiemposSection durations={durations} /> },
    { key: "descartes", label: "Motivos de descarte", badge: discards.total, content: <DescartesSection {...discards} /> },
    { key: "prefiltro", label: "Prefiltro", content: <PrefiltroSection rows={prefilter} /> },
    { key: "vista-previa", label: "Vista previa de correos", content: <EmailPreviewSection kind={emailKind} clientId={clientId} role={session.role} email={session.email} /> },
    { key: "correos", label: "Correos enviados", badge: runs.length, content: <CorreosSection runs={runs} /> },
    ...(session.role === "admin" ? [{ key: "inteligencia", label: "Inteligencia interna", badge: insights.length, content: <InsightsSection insights={insights} /> }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reportes" subtitle={scope ? `Filtrado: ${scope}` : "Todas las vacantes y clientes"} />
      <div className="mb-6 rounded-card border border-line bg-surface px-5 py-4">
        <ReportFilters clients={clients.map((c) => ({ id: c.id, name: c.name }))} profiles={profiles.map((p) => ({ id: p.id, name: p.title }))} clientId={clientId} profileId={profileId} />
      </div>
      <Tabs items={tabs} initial={correo ? "vista-previa" : undefined} />
    </div>
  );
}
