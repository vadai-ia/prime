import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { fmtDate, fmtDateLong, fmtMonths } from "@/lib/format";
import type { WeeklyClientData } from "./data";

// PDF del reporte semanal al cliente (plan §12.23): lo mismo que el correo, en carta, para que el
// cliente lo archive o lo reenvíe. Helvetica (viene con el PDF): sin descargar fuentes en el cron.

const C = { forest: "#007a6e", leaf: "#00897b", mint: "#e3f8f5", paper: "#f5f6f6", line: "#e2e5e5", ink: "#171717", slate: "#525252", info: "#2c5fa8" };

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.ink, lineHeight: 1.4 },
  header: { borderBottomWidth: 2, borderBottomColor: C.forest, paddingBottom: 10, marginBottom: 16 },
  logo: { width: 150, marginBottom: 8 },
  brand: { fontSize: 9, color: C.forest, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 4, lineHeight: 1.25 },
  subtitle: { fontSize: 10, color: C.slate, marginTop: 4 },
  h: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: C.forest, marginTop: 18, marginBottom: 8 },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 8 },
  kpi: { flex: 1, backgroundColor: C.paper, borderRadius: 4, padding: 10 },
  kpiValue: { fontSize: 18, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginBottom: 4 },
  kpiLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },
  kpiHint: { fontSize: 8, color: C.slate, marginTop: 1 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  barLabel: { width: 170, fontSize: 9 },
  barTrack: { flex: 1, height: 9, backgroundColor: C.paper, borderRadius: 2 },
  barValue: { width: 50, fontSize: 9, textAlign: "right", fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5 },
  cellLabel: { width: "45%", color: C.slate },
  cellValue: { flex: 1, fontFamily: "Helvetica-Bold" },
  bullet: { flexDirection: "row", marginBottom: 4 },
  muted: { fontSize: 8.5, color: C.slate },
  footerLeft: { position: "absolute", bottom: 22, left: 44, fontSize: 7.5, color: C.slate },
});

function Kpis({ items }: { items: { label: string; value: string | number; hint: string }[] }) {
  return (
    <View style={s.kpis}>
      {items.map((k) => (
        <View key={k.label} style={s.kpi}>
          <Text style={s.kpiValue}>{k.value}</Text>
          <Text style={s.kpiLabel}>{k.label}</Text>
          <Text style={s.kpiHint}>{k.hint}</Text>
        </View>
      ))}
    </View>
  );
}

function Bars({ items }: { items: { label: string; value: number; max: number; color: string; right?: string }[] }) {
  return (
    <View>
      {items.map((b) => (
        <View key={b.label} style={s.barRow} wrap={false}>
          <Text style={s.barLabel}>{b.label}</Text>
          <View style={s.barTrack}>
            <View style={{ width: `${Math.max(0, Math.min(100, (b.value / Math.max(1, b.max)) * 100))}%`, height: 9, backgroundColor: b.color, borderRadius: 2 }} />
          </View>
          <Text style={s.barValue}>{b.right ?? String(b.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function WeeklyPdf({ data, logo }: { data: WeeklyClientData; logo: Buffer | null }) {
  const k = data.kpis;
  const hp = data.hiredProfile;
  const funnelMax = Math.max(1, data.funnel[0]?.value ?? 0);
  const channelMax = Math.max(1, ...data.channels.map((c) => c.applications));
  return (
    <Document title={`Reporte semanal ${data.week} · ${data.client.name}`} author="Prime HR Innovation" language="es-MX">
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf, no de HTML: no tiene alt */}
          {logo ? <Image style={s.logo} src={{ data: logo, format: "png" }} /> : <Text style={s.brand}>PRIME HR INNOVATION</Text>}
          <Text style={s.title}>Reporte semanal de reclutamiento · {data.client.name}</Text>
          <Text style={s.subtitle}>
            Semana {data.week} · del {fmtDate(data.periodStart)} al {fmtDateLong(data.periodEnd)}
          </Text>
        </View>

        <Kpis
          items={[
            { label: "Candidatos nuevos", value: k.newApplications, hint: "Últimos 7 días" },
            { label: "Entrevistas Prime", value: k.primeInterviews, hint: "Realizadas" },
            { label: "Listos para ustedes", value: k.readyForClient, hint: "Con expediente y psicométrico" },
          ]}
        />
        <Kpis
          items={[
            { label: "Contratados", value: k.hiredTotal, hint: `${k.hiredWeek} esta semana · ${k.openings} ${k.openings === 1 ? "vacante abierta" : "vacantes abiertas"}` },
            { label: "Días a contratación", value: k.daysToHire === null ? "—" : Math.round(k.daysToHire), hint: "Mediana, de postulación a contratado" },
          ]}
        />

        <Text style={s.h}>Embudo acumulado</Text>
        <Bars items={data.funnel.map((f) => ({ label: f.label, value: f.value, max: funnelMax, color: f.key === "hired" ? C.forest : C.leaf }))} />

        {data.channels.length > 0 && (
          <View wrap={false}>
            <Text style={s.h}>Canal de origen</Text>
            <Bars items={data.channels.map((c) => ({ label: c.label, value: c.applications, max: channelMax, color: C.info, right: `${c.passedPrime}/${c.applications}` }))} />
            <Text style={s.muted}>A la derecha: cuántos pasaron la entrevista con Prime del total de postulados.</Text>
          </View>
        )}

        <View wrap={false}>
          <Text style={s.h}>Estado por vacante</Text>
          {data.vacancies.length === 0 ? (
            <Text style={s.muted}>Sin vacantes activas.</Text>
          ) : (
            <Bars items={data.vacancies.map((v) => ({ label: `${v.title} · ${v.inProcess} en proceso`, value: v.hired, max: Math.max(1, v.openings), color: C.forest, right: `${v.hired}/${v.openings}` }))} />
          )}
        </View>

        {hp && (
          <View wrap={false}>
            <Text style={s.h}>Perfil de quien se contrató</Text>
            {[
              ["Contratados", String(hp.count)],
              ["Edad promedio", hp.avgAge === null ? "—" : `${Math.round(hp.avgAge)} años`],
              ["Experiencia promedio", hp.avgExperience === null ? "—" : fmtMonths(Math.round(hp.avgExperience))],
              ["Escolaridad más común", hp.topEducation ?? "—"],
              ["Canal más efectivo", hp.bestChannel ?? "—"],
              ["Score de CV promedio", hp.avgCvScore === null ? "—" : String(Math.round(hp.avgCvScore))],
            ].map(([label, value]) => (
              <View key={label} style={s.row}>
                <Text style={s.cellLabel}>{label}</Text>
                <Text style={s.cellValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h}>Siguientes pasos</Text>
        {data.nextSteps.length === 0 ? (
          <Text style={s.muted}>Seguimos filtrando candidatos; en cuanto alguien llegue a psicométrico lo verán aquí.</Text>
        ) : (
          data.nextSteps.map((step) => (
            <View key={step} style={s.bullet} wrap={false}>
              <Text style={{ width: 10 }}>•</Text>
              <Text style={{ flex: 1 }}>{step}</Text>
            </View>
          ))
        )}

        <Text style={s.footerLeft} fixed>
          Prime HR Innovation · Los datos de los candidatos se tratan conforme a la LFPDPPP.
        </Text>
      </Page>
    </Document>
  );
}

// Logo con texto oscuro (fondo blanco). Va en el bundle de Vercel por outputFileTracingIncludes (next.config.ts);
// si no se encuentra, el PDF sale con el nombre en texto en lugar de fallar.
async function loadLogo(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "src/lib/email/logo-pdf.png"));
  } catch {
    return null;
  }
}

export async function renderWeeklyPdf(data: WeeklyClientData): Promise<Buffer> {
  return renderToBuffer(<WeeklyPdf data={data} logo={await loadLogo()} />);
}
