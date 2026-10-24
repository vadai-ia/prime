import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, FileText, GraduationCap, Mail, MapPin, Megaphone, Phone, User } from "lucide-react";
import { requireStaff } from "@/lib/dal";
import { can } from "@/lib/auth/permissions";
import { getApplicationDetail, getCandidateHistory } from "@/lib/queries/pipeline";
import { listProfileTeam } from "@/lib/queries/assignments";
import { listStaff } from "@/lib/queries/users";
import { getBlacklistEntry } from "@/lib/queries/blacklist";
import { getMyOutlook } from "@/lib/queries/integrations";
import { listApplicationFollowups } from "@/lib/queries/followups";
import { CHANNEL_LABELS } from "@/lib/labels";
import { fmtDate, fmtDateTime, fmtPhone } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { StagePill } from "@/components/ui/pill";
import { Tabs } from "@/components/ui/tabs";
import { StageActions } from "@/components/candidate/stage-actions";
import { AssignedRecruiter } from "@/components/candidate/assigned-recruiter";
import { CandidateHistory } from "@/components/candidate/history";
import { Resumen } from "@/components/candidate/resumen";
import { WhatsApp } from "@/components/candidate/whatsapp";
import { Entrevista } from "@/components/candidate/entrevista";
import { Psicometrico } from "@/components/candidate/psicometrico";
import { Expediente } from "@/components/candidate/expediente";
import { BlacklistPanel } from "@/components/candidate/blacklist-panel";
import { PermanenciaPanel } from "@/components/candidate/permanencia-panel";

export async function generateMetadata(props: PageProps<"/candidatos/[applicationId]">): Promise<Metadata> {
  const { applicationId } = await props.params;
  const detail = await getApplicationDetail(applicationId);
  return { title: `${detail?.candidate.full_name ?? "Candidato"} · Prime HR Innovation` };
}

export default async function CandidatoPage(props: PageProps<"/candidatos/[applicationId]">) {
  const session = await requireStaff();
  const { applicationId } = await props.params;
  const detail = await getApplicationDetail(applicationId);
  if (!detail) notFound();

  const { candidate: c, application: a, pipeline: p } = detail;
  // El reclutador solo llega aquí si el candidato es suyo; quién lo lleva y reasignarlo es cosa del admin.
  const canBlacklist = can(session.role, "view_blacklist");
  const [team, staff, history, query, blacklisted, outlook, followups] = await Promise.all([
    can(session.role, "manage_assignments") ? listProfileTeam(a.profile_id) : null,
    listStaff(),
    getCandidateHistory(c.phone_e164),
    props.searchParams,
    canBlacklist ? getBlacklistEntry(c.id) : null,
    getMyOutlook(),
    a.hired_at ? listApplicationFollowups(a.id) : [],
  ]);
  const tab = typeof query.tab === "string" ? query.tab : undefined;
  const docsDone = p.docs_validated ?? 0;
  const docsTotal = p.docs_required ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/candidatos" className="text-xs text-ink-muted hover:text-forest">
        ← Candidatos
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar name={c.full_name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-ink">{c.full_name}</h1>
              <StagePill stage={a.stage} />
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              {p.profile_title} · {p.client_name}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
              <Meta icon={<Phone className="h-3.5 w-3.5" />} value={fmtPhone(c.phone_e164)} />
              {c.email && <Meta icon={<Mail className="h-3.5 w-3.5" />} value={c.email} />}
              <Meta icon={<MapPin className="h-3.5 w-3.5" />} value={[c.zone, c.municipality].filter(Boolean).join(", ") || "Sin zona"} />
              {c.age_reported !== null && <Meta icon={<User className="h-3.5 w-3.5" />} value={`${c.age_reported} años`} />}
              {c.education_level && <Meta icon={<GraduationCap className="h-3.5 w-3.5" />} value={c.education_level} />}
              <Meta icon={<Megaphone className="h-3.5 w-3.5" />} value={CHANNEL_LABELS[a.source_channel]} />
              <Meta icon={<Calendar className="h-3.5 w-3.5" />} value={`Postuló el ${fmtDate(a.applied_at, { day: "numeric", month: "long" })}`} />
              {c.cv_file_path && (
                <a href={`/candidatos/${a.id}/cv`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-medium text-forest hover:underline">
                  <FileText className="h-3.5 w-3.5" />
                  Ver CV
                </a>
              )}
            </dl>
            {team && <AssignedRecruiter applicationId={a.id} recruiterId={a.assigned_recruiter_id} team={team} />}
          </div>
        </div>
        <StageActions applicationId={a.id} stage={a.stage} discardedFrom={a.discarded_from_stage} />
      </div>

      {canBlacklist && (
        <div className="mt-5">
          <BlacklistPanel
            candidateId={c.id}
            applicationId={a.id}
            entry={blacklisted && { id: blacklisted.id, reason_key: blacklisted.reason_key, reason_note: blacklisted.reason_note, added_by_name: blacklisted.added_by_name, added_at_label: fmtDateTime(blacklisted.added_at) }}
          />
        </div>
      )}

      {followups.length > 0 && (
        <div className="mt-5">
          <PermanenciaPanel applicationId={a.id} rows={followups} />
        </div>
      )}

      <div className="mt-6">
        <CandidateHistory rows={history} currentApplicationId={a.id} />
      </div>

      <div className="mt-8">
        <Tabs
          initial={tab}
          items={[
            { key: "resumen", label: "Resumen", content: <Resumen detail={detail} /> },
            { key: "whatsapp", label: "WhatsApp", badge: detail.conversation?.messages.length, content: <WhatsApp detail={detail} /> },
            { key: "entrevista", label: "Entrevista", badge: detail.interviews.length || undefined, content: <Entrevista detail={detail} staff={staff.map((u) => ({ id: u.id, full_name: u.full_name || u.email }))} currentUserId={session.userId} outlookConnected={!!outlook} /> },
            { key: "psicometrico", label: "Psicométrico", badge: p.psych_fit_pct !== null ? `${p.psych_fit_pct}%` : undefined, content: <Psicometrico detail={detail} /> },
            { key: "expediente", label: "Expediente", badge: docsDone > 0 || a.stage === "documents" ? `${docsDone}/${docsTotal}` : undefined, content: <Expediente detail={detail} /> },
          ]}
        />
      </div>
    </div>
  );
}

function Meta({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-faint">{icon}</span>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
