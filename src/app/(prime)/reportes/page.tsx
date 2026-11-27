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
import { utcIsoToZoned, zonedToUtcIso } from "@/lib/domain/time";
import { addDays } from "@/lib/email/schedule";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Reportes · Prime HR Innovation" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);
const day = (v: string | string[] | undefined) => {
  const d = one(v);
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
};

export default async function ReportesPage(props: { searchParams: Promise<Search> }) {
  const session = await requireStaff();
  const sp = await props.searchParams;
  const clientId = one(sp.client);
  const profileId = one(sp.profile);
  // Periodo en días locales de México: desde las 00:00 de "desde" hasta las 24:00 de "hasta".
  let desde = day(sp.desde);
  let hasta = day(sp.hasta);
  if (desde && hasta && desde > hasta) [desde, hasta] = [hasta, desde];
  const from = desde ? zonedToUtcIso(desde, "00:00") ?? undefined : undefined;
  const to = hasta ? zonedToUtcIso(addDays(hasta, 1), "00:00") ?? undefined : undefined;
  const filters = { clientId, profileId, from, to };
  const today = utcIsoToZoned(new Date().toISOString()).date;
  const envio = day(sp.envio);
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
    listReportRuns(from || to ? 200 : 30, { from, to }),
    session.role === "admin" ? listInsights() : Promise.resolve([]),
  ]);

  const funnel = aggregateFunnel(funnelRows);
  const channels = aggregateChannels(channelRows);
  const durations = aggregateDurations(durationRows);
  const discards = aggregateDiscards(discardRows);
  const prefilter = aggregatePrefilter(prefilterRows);

  const periodLabel =
    desde && hasta ? `del ${fmtDate(from)} al ${fmtDate(zonedToUtcIso(hasta, "12:00"))}` : desde ? `desde el ${fmtDate(from)}` : hasta ? `hasta el ${fmtDate(zonedToUtcIso(hasta, "12:00"))}` : null;
  const scope = [clients.find((c) => c.id === clientId)?.name, profiles.find((p) => p.id === profileId)?.title, periodLabel].filter(Boolean).join(" · ");

  const tabs = [
    { key: "embudo", label: "Embudo", content: <EmbudoSection stages={funnel.stages} discarded={funnel.discarded} /> },
    { key: "canales", label: "Canales", content: <CanalesSection channels={channels} /> },
    { key: "tiempos", label: "Tiempos por etapa", content: <TiemposSection durations={durations} /> },
    { key: "descartes", label: "Motivos de descarte", badge: discards.total, content: <DescartesSection {...discards} /> },
    { key: "prefiltro", label: "Prefiltro", content: <PrefiltroSection rows={prefilter} /> },
    { key: "vista-previa", label: "Vista previa de correos", content: <EmailPreviewSection kind={emailKind} clientId={clientId} role={session.role} email={session.email} sendDate={envio} today={today} /> },
    { key: "correos", label: "Correos enviados", badge: runs.length, content: <CorreosSection runs={runs} /> },
    ...(session.role === "admin" ? [{ key: "inteligencia", label: "Inteligencia interna", badge: insights.length, content: <InsightsSection insights={insights} /> }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Reportes" subtitle={scope ? `Filtrado: ${scope}` : "Todas las vacantes y clientes"} />
      <div className="mb-6 rounded-card border border-line bg-surface px-5 py-4">
        <ReportFilters clients={clients.map((c) => ({ id: c.id, name: c.name }))} profiles={profiles.map((p) => ({ id: p.id, name: p.title }))} clientId={clientId} profileId={profileId} period={{ desde, hasta }} today={today} />
      </div>
      {periodLabel && (
        <p className="-mt-3 mb-5 text-xs text-ink-muted">
          Con periodo: el embudo y los canales cuentan las postulaciones que llegaron en esas fechas; los tiempos, las estancias que empezaron; los descartes y el prefiltro, los que pasaron en esas fechas. La vista previa de correos no usa el periodo: tiene su propio día de envío.
        </p>
      )}
      <Tabs items={tabs} initial={correo ? "vista-previa" : undefined} />
    </div>
  );
}
