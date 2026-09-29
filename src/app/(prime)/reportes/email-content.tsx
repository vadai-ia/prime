import { getClientRow } from "@/lib/queries/clients";
import { listInterviews } from "@/lib/queries/interviews";
import { listPipeline } from "@/lib/queries/pipeline";
import { listProfiles } from "@/lib/queries/profiles";
import { listStaff } from "@/lib/queries/users";
import { WEEKDAY_LABELS } from "@/lib/labels";
import type { Role } from "@/lib/auth/roles";
import { buildDailyClient, buildDailyInternal, buildWeeklyClient } from "@/lib/email/data";
import { DailyClientEmail, DailyInternalEmail, WeeklyClientEmail, dailyClientSubject, dailyInternalSubject, weeklyClientSubject } from "@/lib/email/templates";
import { EmailPreview, type EmailEnvelope, type EmailKind } from "./email-preview";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const hhmm = (t: string) => t.slice(0, 5);

/** Pestaña "Vista previa de correos": arma el correo elegido con los datos que el usuario puede ver. */
export async function EmailPreviewSection({ kind, clientId, role, email }: { kind: EmailKind; clientId?: string; role: Role; email: string | null }) {
  const [rows, interviews, profiles] = await Promise.all([listPipeline({ includeDiscarded: true }), listInterviews("all"), listProfiles({ status: "active" })]);
  const now = new Date();
  const isAdmin = role === "admin";
  const clientNote = isAdmin ? undefined : "Vista con tus permisos: solo aparecen tus candidatos. El correo real al cliente incluye los de todo el equipo.";

  // Clientes con al menos una vacante activa: son los que reciben los correos al cliente.
  const clientOptions = [...new Map(profiles.map((p) => [p.client_id, { id: p.client_id, name: p.client_name }])).values()].sort((a, b) => a.name.localeCompare(b.name));

  if (kind === "interno") {
    // Los admins reciben todo; cada reclutador, su propia versión con sus vacantes y candidatos.
    const admins = isAdmin ? (await listStaff()).filter((s) => s.role === "admin").map((s) => s.email) : [];
    const data = buildDailyInternal({ rows, interviews, profiles, now });
    const envelope: EmailEnvelope = {
      to: isAdmin ? admins : email ? [email] : [],
      subject: dailyInternalSubject(data),
      schedule: "Diario a las 18:00, automático",
      note: isAdmin ? "Versión de administración. Cada reclutador recibe la suya, solo con sus vacantes y candidatos." : "Así te llegará a ti: solo con tus vacantes y candidatos.",
    };
    return (
      <EmailPreview kind={kind} clients={clientOptions} envelope={envelope}>
        <DailyInternalEmail data={data} appUrl={appUrl()} />
      </EmailPreview>
    );
  }

  const selectedId = clientOptions.some((c) => c.id === clientId) ? clientId : clientOptions[0]?.id;
  const client = selectedId ? await getClientRow(selectedId) : null;
  if (!client) return <EmailPreview kind={kind} clients={clientOptions} envelope={null}>{null}</EmailPreview>;

  const to = client.report_recipients.length ? client.report_recipients : client.contact_email ? [client.contact_email] : [];

  if (kind === "cliente") {
    const data = buildDailyClient({ rows, client, now });
    return (
      <EmailPreview kind={kind} clientId={client.id} clients={clientOptions} envelope={{ to, subject: dailyClientSubject(data), schedule: `Diario a las ${hhmm(client.daily_report_time)}, automático`, note: clientNote }}>
        <DailyClientEmail data={data} appUrl={appUrl()} />
      </EmailPreview>
    );
  }

  const data = buildWeeklyClient({ rows, interviews, profiles, client, now });
  const day = WEEKDAY_LABELS[client.weekly_report_dow] ?? "Viernes";
  return (
    <EmailPreview
      kind={kind}
      clientId={client.id}
      clients={clientOptions}
      envelope={{ to, subject: weeklyClientSubject(data), schedule: `${day} a las ${hhmm(client.weekly_report_time)}, automático, con PDF adjunto`, note: clientNote }}
    >
      <WeeklyClientEmail data={data} appUrl={appUrl()} />
    </EmailPreview>
  );
}
