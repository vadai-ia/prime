import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/db/types";
import {
  findOnlineMeeting,
  getAccessToken,
  listTranscripts,
  MicrosoftGraphError,
  teamsTranscriptsEnabled,
  transcriptVtt,
} from "@/lib/integrations/microsoft-graph";

// Transcripción de Teams de una entrevista (plan §12.24). El evento se crea con grabación automática;
// terminada la reunión, Microsoft deja la transcripción en la reunión del organizador (el dueño del
// calendario) y aquí se lee con su token y se guarda en interview_transcripts (service role; el
// staff la lee por RLS con app.can_access_application). Se busca con el barrido diario y con el
// botón de la ficha; mientras no exista, la tarea queda para el siguiente intento.

type Admin = ReturnType<typeof createAdminClient>;
type Outcome = { ok: true; detail?: string } | { ok: false; error: string; retry: boolean };

export type TranscriptSentence = { speaker_name: string; text: string; start_time: number };

/** "00:01:02.500" → 62.5 */
function seconds(stamp: string): number {
  const parts = stamp.trim().split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + (Number.isFinite(n) ? n : 0), 0);
}

/**
 * WebVTT de Teams → intervenciones. Cada bloque trae `inicio --> fin` y `<v Nombre>texto</v>`; las
 * intervenciones seguidas de la misma persona se juntan. `offset` suma la duración de las partes
 * anteriores cuando la reunión tuvo varias transcripciones.
 */
export function parseVtt(vtt: string, offset = 0): { sentences: TranscriptSentence[]; end: number } {
  const sentences: TranscriptSentence[] = [];
  let start = 0;
  let end = 0;
  for (const line of vtt.replace(/\r/g, "").split("\n")) {
    const time = line.match(/^([\d:.]+)\s+-->\s+([\d:.]+)/);
    if (time) {
      start = seconds(time[1]!);
      end = Math.max(end, seconds(time[2]!));
      continue;
    }
    const voice = line.match(/^<v\s+([^>]*)>(.*?)(?:<\/v>)?$/);
    const speaker = voice ? voice[1]!.trim() || "Sin nombre" : null;
    const text = (voice ? voice[2]! : line).replace(/<[^>]+>/g, "").trim();
    if (!text || line.startsWith("WEBVTT") || /^NOTE\b/.test(line) || (!voice && (/^\d+$/.test(line) || /^[\w-]+\/\d+-\d+$/.test(line)))) continue;
    const last = sentences.at(-1);
    const name = speaker ?? last?.speaker_name ?? "Sin nombre";
    if (last && last.speaker_name === name) last.text = `${last.text} ${text}`;
    else sentences.push({ speaker_name: name, text, start_time: Math.round((offset + start) * 10) / 10 });
  }
  return { sentences, end: offset + end };
}

export function transcriptText(sentences: TranscriptSentence[]): string {
  return sentences.map((s) => `${s.speaker_name}: ${s.text}`).join("\n");
}

/** Trae y guarda la transcripción. retry: true mientras Teams todavía no la tenga. */
export async function fetchInterviewTranscript(admin: Admin, interviewId: string): Promise<Outcome> {
  if (!teamsTranscriptsEnabled()) return { ok: false, error: "La transcripción de Teams no está activada (TEAMS_TRANSCRIPTS=1 y permisos en Entra ID).", retry: false };

  const { data: iv, error } = await admin.from("interviews").select("id, status, scheduled_at, meeting_url, calendar_owner_id").eq("id", interviewId).maybeSingle();
  if (error) return { ok: false, error: error.message, retry: true };
  if (!iv) return { ok: false, error: "La entrevista ya no existe", retry: false };
  if (iv.status === "cancelled") return { ok: true, detail: "cancelada; no se busca" };
  if (!iv.meeting_url || !iv.calendar_owner_id) return { ok: false, error: "La entrevista no se agendó con Outlook: no hay reunión de Teams que leer", retry: false };
  if (iv.scheduled_at && new Date(iv.scheduled_at) > new Date()) return { ok: false, error: "La entrevista todavía no empieza", retry: true };

  const { data: existing } = await admin.from("interview_transcripts").select("interview_id").eq("interview_id", interviewId).maybeSingle();
  if (existing) return { ok: true, detail: "ya estaba guardada" };

  try {
    const token = await getAccessToken(iv.calendar_owner_id);
    if (!token) return { ok: false, error: "Quien agendó ya no tiene Outlook conectado", retry: false };
    const meeting = await findOnlineMeeting(token, iv.meeting_url);
    if (!meeting) return { ok: false, error: "Teams no encontró la reunión de esta entrevista", retry: false };
    const parts = await listTranscripts(token, meeting.id);
    if (parts.length === 0) return { ok: false, error: "Teams todavía no tiene transcripción (¿se grabó?)", retry: true };

    const sentences: TranscriptSentence[] = [];
    let offset = 0;
    for (const part of parts) {
      const parsed = parseVtt(await transcriptVtt(token, meeting.id, part.id), offset);
      sentences.push(...parsed.sentences);
      offset = parsed.end;
    }
    if (sentences.length === 0) return { ok: false, error: "La transcripción de Teams vino vacía", retry: false };

    const { error: saveError } = await admin.from("interview_transcripts").upsert({
      interview_id: interviewId,
      language: "es",
      text: transcriptText(sentences),
      sentences: sentences as unknown as Json,
      duration_sec: Math.round(offset),
      received_at: new Date().toISOString(),
    });
    if (saveError) return { ok: false, error: saveError.message, retry: true };
    return { ok: true, detail: `${sentences.length} intervenciones, ${Math.round(offset / 60)} min` };
  } catch (e) {
    const status = e instanceof MicrosoftGraphError ? e.status : undefined;
    // 403: falta el permiso o la directiva de Teams no deja transcribir; reintentar no sirve.
    const permanent = status === 401 || status === 403;
    return { ok: false, error: e instanceof Error ? e.message : String(e), retry: !permanent };
  }
}

/** Barrido diario: entrevistas de los últimos 3 días, agendadas con Outlook y sin transcripción. */
export async function sweepTeamsTranscripts(admin: Admin, enqueueOne: (interviewId: string) => Promise<boolean>, now = new Date()): Promise<Outcome> {
  if (!teamsTranscriptsEnabled()) return { ok: true, detail: "La transcripción de Teams no está activada; no se buscó nada" };
  const from = new Date(now.getTime() - 3 * 24 * 3600_000).toISOString();
  const { data, error } = await admin
    .from("interviews")
    .select("id, interview_transcripts(interview_id)")
    .neq("status", "cancelled")
    .not("meeting_url", "is", null)
    .not("calendar_owner_id", "is", null)
    .gte("scheduled_at", from)
    .lt("scheduled_at", now.toISOString());
  if (error) return { ok: false, error: error.message, retry: true };

  let queued = 0;
  for (const iv of data ?? []) {
    const has = Array.isArray(iv.interview_transcripts) ? iv.interview_transcripts.length > 0 : !!iv.interview_transcripts;
    if (!has && (await enqueueOne(iv.id))) queued++;
  }
  return { ok: true, detail: `${queued} entrevistas por revisar` };
}
