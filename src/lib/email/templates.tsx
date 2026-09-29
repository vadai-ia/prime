// Plantillas de los tres correos automáticos (plan §6.6). HTML de correo: tablas y estilos en línea,
// porque Gmail y Outlook no leen clases ni variables CSS. Sin hooks: la vista previa en Reportes
// las pinta tal cual y al conectar Resend se mandan con renderToStaticMarkup (o su prop `react`).
import type { CSSProperties, ReactNode } from "react";
import { PSYCH_VERDICT_LABELS, STAGE_LABELS, type Stage } from "@/lib/labels";
import { fmtDate, fmtDateLong, fmtMonths, fmtTime } from "@/lib/format";
import type { DailyClientData, DailyInternalData, WeeklyClientData } from "./data";

// Paleta de marca (globals.css) repetida aquí: los clientes de correo no leen variables CSS.
const C = {
  forest: "#0e4632",
  forest2: "#145a41",
  leaf: "#1e8a57",
  lime: "#8fd45d",
  mint: "#ddf2e6",
  paper: "#f5f8f6",
  line: "#d8e4dc",
  ink: "#152019",
  slate: "#5d6d63",
  amber: "#b7791f",
  amberSoft: "#fbf1dc",
  info: "#2c5fa8",
  infoSoft: "#e4ecf8",
  danger: "#b93a32",
  dangerSoft: "#fbe7e5",
};
const FONT = '"IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif';

const p: CSSProperties = { margin: "0 0 14px", fontSize: 14, lineHeight: 1.6, color: C.ink };
const muted: CSSProperties = { color: C.slate, fontSize: 12.5 };
const th: CSSProperties = { padding: "6px 8px", borderBottom: `1px solid ${C.line}`, fontSize: 12, fontWeight: 600, color: C.slate, textAlign: "left" };
const td: CSSProperties = { padding: "7px 8px", borderBottom: `1px solid ${C.line}`, fontSize: 13, color: C.ink, verticalAlign: "top" };
const num: CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function Shell({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div style={{ background: C.paper, padding: "24px 12px", fontFamily: FONT }}>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 640, margin: "0 auto", background: "#ffffff", border: `1px solid ${C.line}`, borderRadius: 12, borderCollapse: "separate", overflow: "hidden" }}>
        <tbody>
          <tr>
            <td style={{ background: C.forest, backgroundImage: `linear-gradient(160deg, ${C.forest}, ${C.forest2})`, padding: "18px 24px" }}>
              <div style={{ color: "#ffffff", fontSize: 16, fontWeight: 700 }}>Prime HR Innovation</div>
              <div style={{ color: C.lime, fontSize: 12.5, marginTop: 2 }}>{subtitle}</div>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "22px 24px 8px" }}>{children}</td>
          </tr>
          <tr>
            <td style={{ padding: "14px 24px 20px", borderTop: `1px solid ${C.line}`, ...muted, lineHeight: 1.5 }}>{footer}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function H({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 14.5, fontWeight: 600, color: C.forest, padding: "4px 0 6px", borderBottom: `2px solid ${C.mint}`, margin: "18px 0 10px" }}>{children}</div>;
}

function Tag({ children, tone = "mint" }: { children: ReactNode; tone?: "mint" | "info" | "amber" | "danger" }) {
  const [bg, fg] = { mint: [C.mint, C.forest], info: [C.infoSoft, C.info], amber: [C.amberSoft, C.amber], danger: [C.dangerSoft, C.danger] }[tone];
  return <span style={{ display: "inline-block", background: bg, color: fg, borderRadius: 999, padding: "2px 9px", fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
}

function Kpis({ items }: { items: { label: string; value: ReactNode; hint?: string }[] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "4px 0 8px" }}>
      <tbody>
        <tr>
          {items.map((k) => (
            <td key={k.label} style={{ width: `${100 / items.length}%`, padding: 4, verticalAlign: "top" }}>
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 11.5, color: C.slate }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: C.forest, lineHeight: 1.2, marginTop: 2 }}>{k.value}</div>
                {k.hint && <div style={{ fontSize: 11, color: C.slate, marginTop: 2 }}>{k.hint}</div>}
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** Barra horizontal con tablas: funciona en cualquier cliente de correo. */
function Bars({ items }: { items: { label: string; value: number; max: number; color?: string; right?: string }[] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
      <tbody>
        {items.map((b) => {
          const pct = b.max > 0 ? Math.max(b.value > 0 ? 2 : 0, Math.round((b.value / b.max) * 100)) : 0;
          return (
            <tr key={b.label}>
              <td style={{ padding: "4px 10px 4px 0", fontSize: 13, color: C.ink, width: "38%" }}>{b.label}</td>
              <td style={{ padding: "4px 0" }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ background: C.paper, borderRadius: 999 }}>
                  <tbody>
                    <tr>
                      {pct > 0 && <td style={{ width: `${pct}%`, height: 10, background: b.color ?? C.leaf, borderRadius: 999 }} />}
                      <td style={{ height: 10 }} />
                    </tr>
                  </tbody>
                </table>
              </td>
              <td style={{ padding: "4px 0 4px 10px", fontSize: 13, fontWeight: 600, ...num, width: 56 }}>{b.right ?? b.value}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Button({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} style={{ display: "inline-block", background: C.leaf, color: "#ffffff", textDecoration: "none", fontSize: 13.5, fontWeight: 600, borderRadius: 8, padding: "9px 16px", margin: "8px 0 14px" }}>
      {children}
    </a>
  );
}

const SHORT: Partial<Record<Stage, string>> = { new: "Nuevos", prefilter: "Prefiltro", cv_review: "CV", prime_interview: "Entrev.", psychometric: "Psico", documents: "Exped.", client_interview: "Cliente", hired: "Contr." };
const TABLE_STAGES: Stage[] = ["new", "prefilter", "cv_review", "prime_interview", "psychometric", "documents", "client_interview", "hired"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] ?? "";

// ─── Resumen diario interno ───────────────────────────────────────────────

export function dailyInternalSubject(d: DailyInternalData) {
  return `Resumen del día · ${fmtDate(d.date, { weekday: "long", day: "numeric", month: "long" })}`;
}

export function DailyInternalEmail({ data, appUrl }: { data: DailyInternalData; appUrl: string }) {
  const t = data.totals;
  return (
    <Shell subtitle="Resumen diario interno" footer={<>Se envía todos los días a las 18:00 al equipo de Prime. Cada reclutador recibe solo sus vacantes y candidatos.</>}>
      <p style={p}>
        Hola equipo, así cerró el día en {plural(data.vacancies.length, "vacante activa", "vacantes activas")}: {plural(t.newToday, "postulación nueva", "postulaciones nuevas")}, {plural(t.advancedToday, "candidato avanzó", "candidatos avanzaron")} de etapa y{" "}
        {plural(t.hiredToday, "contratación", "contrataciones")}. Hay {plural(t.active, "candidato", "candidatos")} en proceso.
      </p>

      {data.vacancies.length > 0 && (
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse", margin: "4px 0 6px" }}>
          <thead>
            <tr>
              <th style={th}>Vacante</th>
              {TABLE_STAGES.map((s) => (
                <th key={s} style={{ ...th, ...num }}>
                  {SHORT[s]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.vacancies.map((v) => (
              <tr key={v.id}>
                <td style={td}>
                  {v.title}
                  <div style={muted}>{v.client_name}</div>
                </td>
                {TABLE_STAGES.map((s) => (
                  <td key={s} style={{ ...td, ...num, fontWeight: s === "hired" && v.counts[s] ? 600 : 400, color: v.counts[s] ? C.ink : C.line }}>
                    {v.counts[s]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <H>Requieren decisión del reclutador</H>
      {data.attention.length === 0 ? (
        <p style={{ ...p, color: C.slate }}>Nada pendiente. El agente y los reclutadores van al día.</p>
      ) : (
        <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6, color: C.ink }}>
          {data.attention.slice(0, 12).map((a) => (
            <li key={a.application_id}>
              <a href={`${appUrl}/candidatos/${a.application_id}`} style={{ color: C.forest, fontWeight: 600, textDecoration: "none" }}>
                {a.name}
              </a>{" "}
              ({a.vacancy}): {a.reason.toLowerCase()}
              {a.days ? `, ${plural(a.days, "día", "días")} en la etapa` : ""}.
            </li>
          ))}
          {data.attention.length > 12 && <li style={{ color: C.slate }}>Y {data.attention.length - 12} más en el tablero.</li>}
        </ul>
      )}

      <H>Mañana</H>
      {data.tomorrow.length === 0 ? (
        <p style={{ ...p, color: C.slate }}>Sin entrevistas agendadas.</p>
      ) : (
        <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6, color: C.ink }}>
          {data.tomorrow.map((i) => (
            <li key={i.id}>
              <strong>{fmtTime(i.at)}</strong> {i.type} · {i.candidate} ({i.vacancy}) con {i.with} · {i.platform}
            </li>
          ))}
        </ul>
      )}
      <Button href={`${appUrl}/tablero`}>Abrir el tablero</Button>
    </Shell>
  );
}

// ─── Candidatos que avanzaron (diario al cliente) ─────────────────────────

const CLIENT_STATUS: Partial<Record<Stage, { text: string; tone: "info" | "mint" }>> = {
  psychometric: { text: "Completando psicométrico", tone: "info" },
  documents: { text: "Integrando expediente", tone: "info" },
  client_interview: { text: "Listo para entrevista con ustedes", tone: "mint" },
};

export function dailyClientSubject(d: DailyClientData) {
  return `Candidatos que avanzaron hoy · ${d.client.name}`;
}

export function DailyClientEmail({ data, appUrl }: { data: DailyClientData; appUrl: string }) {
  const total = data.groups.reduce((s, g) => s + g.lines.length, 0);
  return (
    <Shell subtitle={`Avance diario · ${data.client.name}`} footer={<>Recibes este correo porque {data.client.name} recluta con Prime HR Innovation. Los datos de los candidatos se tratan conforme a la LFPDPPP.</>}>
      <p style={p}>
        Hola{firstName(data.client.contact_name) ? ` ${firstName(data.client.contact_name)}` : ""},{" "}
        {total === 0
          ? "por ahora no hay candidatos en las etapas finales de sus vacantes. Les avisamos en cuanto alguien pase la entrevista con Prime."
          : `estos candidatos ya pasaron la entrevista con Prime y siguen en proceso para sus vacantes${data.advancedToday ? `; ${plural(data.advancedToday, "avanzó", "avanzaron")} hoy` : ""}:`}
      </p>
      {data.groups.map((g) => (
        <div key={g.vacancy}>
          <H>
            {g.vacancy} · {plural(g.lines.length, "candidato", "candidatos")}
          </H>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
            <tbody>
              {g.lines.map((l) => (
                <tr key={l.application_id}>
                  <td style={{ ...td, width: 52, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: (l.cv_score ?? 0) >= 70 ? C.leaf : C.amber }}>{l.cv_score ?? "—"}</div>
                    <div style={{ fontSize: 10, color: C.slate }}>CV</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>
                      {l.name}
                      <span style={{ fontWeight: 400, color: C.slate }}>
                        {l.age ? ` · ${l.age} años` : ""}
                        {l.experience_months ? ` · ${fmtMonths(l.experience_months)} de experiencia` : ""}
                      </span>
                    </div>
                    <div style={{ ...muted, marginTop: 2 }}>
                      {l.interview_score !== null ? `Entrevista ${l.interview_score}/100` : "Entrevista sin calificación"} · {l.psych_verdict ? `Psicométrico: ${PSYCH_VERDICT_LABELS[l.psych_verdict]}` : "Psicométrico pendiente"} · Expediente {l.docs_validated}/{l.docs_required}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <Tag tone={CLIENT_STATUS[l.stage]?.tone ?? "info"}>{CLIENT_STATUS[l.stage]?.text ?? STAGE_LABELS[l.stage]}</Tag>{" "}
                      {l.advanced_today && <Tag tone="amber">Avanzó hoy</Tag>}
                      {l.client_interview_at && <span style={{ ...muted, marginLeft: 6 }}>Entrevista {fmtDate(l.client_interview_at, { weekday: "short" })} {fmtTime(l.client_interview_at)}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <Button href={`${appUrl}/portal/candidatos`}>Ver expedientes en el portal</Button>
    </Shell>
  );
}

// ─── Reporte semanal al cliente ───────────────────────────────────────────

export function weeklyClientSubject(d: WeeklyClientData) {
  return `Reporte semanal de reclutamiento · semana ${d.week} · ${d.client.name}`;
}

export function WeeklyClientEmail({ data, appUrl }: { data: WeeklyClientData; appUrl: string }) {
  const k = data.kpis;
  const funnelMax = Math.max(1, data.funnel[0]?.value ?? 0);
  const channelMax = Math.max(1, ...data.channels.map((c) => c.applications));
  const hp = data.hiredProfile;
  return (
    <Shell
      subtitle={`Reporte semanal · ${fmtDate(data.periodStart)} al ${fmtDateLong(data.periodEnd)}`}
      footer={<>Reporte semanal de {data.client.name} con Prime HR Innovation, semana {data.week}. Los datos de los candidatos se tratan conforme a la LFPDPPP.</>}
    >
      <p style={p}>
        Hola{firstName(data.client.contact_name) ? ` ${firstName(data.client.contact_name)}` : ""}, este es el avance de sus vacantes en los últimos 7 días.
      </p>
      <Kpis
        items={[
          { label: "Candidatos nuevos", value: k.newApplications, hint: "Últimos 7 días" },
          { label: "Entrevistas Prime", value: k.primeInterviews, hint: "Realizadas" },
          { label: "Listos para ustedes", value: k.readyForClient, hint: "Con expediente y psicométrico" },
        ]}
      />
      <Kpis
        items={[
          { label: "Contratados", value: k.hiredTotal, hint: `${k.hiredWeek} esta semana · ${plural(k.openings, "vacante abierta", "vacantes abiertas")}` },
          { label: "Días a contratación", value: k.daysToHire === null ? "—" : Math.round(k.daysToHire), hint: "Mediana, de postulación a contratado" },
        ]}
      />

      <H>Embudo acumulado</H>
      <Bars items={data.funnel.map((f) => ({ label: f.label, value: f.value, max: funnelMax, color: f.key === "hired" ? C.forest : C.leaf }))} />

      {data.channels.length > 0 && (
        <>
          <H>Canal de origen</H>
          <Bars items={data.channels.map((c) => ({ label: c.label, value: c.applications, max: channelMax, color: C.info, right: `${c.passedPrime}/${c.applications}` }))} />
          <p style={{ ...muted, margin: "4px 0 0" }}>A la derecha: cuántos pasaron la entrevista con Prime del total de postulados.</p>
        </>
      )}

      <H>Estado por vacante</H>
      {data.vacancies.length === 0 ? (
        <p style={{ ...p, color: C.slate }}>Sin vacantes activas.</p>
      ) : (
        <Bars items={data.vacancies.map((v) => ({ label: `${v.title} · ${v.inProcess} en proceso`, value: v.hired, max: Math.max(1, v.openings), color: C.forest, right: `${v.hired}/${v.openings}` }))} />
      )}

      {hp && (
        <>
          <H>Perfil de quien se contrató</H>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Contratados", String(hp.count)],
                ["Edad promedio", hp.avgAge === null ? "—" : `${Math.round(hp.avgAge)} años`],
                ["Experiencia promedio", hp.avgExperience === null ? "—" : fmtMonths(Math.round(hp.avgExperience))],
                ["Escolaridad más común", hp.topEducation ?? "—"],
                ["Canal más efectivo", hp.bestChannel ?? "—"],
                ["Score de CV promedio", hp.avgCvScore === null ? "—" : String(Math.round(hp.avgCvScore))],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ ...td, color: C.slate, width: "45%" }}>{label}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <H>Siguientes pasos</H>
      {data.nextSteps.length === 0 ? (
        <p style={{ ...p, color: C.slate }}>Seguimos filtrando candidatos; en cuanto alguien llegue a psicométrico lo verán aquí.</p>
      ) : (
        <ul style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.65, color: C.ink }}>
          {data.nextSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      <Button href={`${appUrl}/portal/semanal`}>Ver el reporte en el portal</Button>
    </Shell>
  );
}
