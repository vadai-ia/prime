"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { rescheduleInterview, scheduleInterview, setInterviewStatus } from "@/actions/interviews";
import { alertErrorClass, buttonPrimaryClass, inputClass, labelClass } from "@/components/ui/form";
import type { Enums } from "@/lib/db/types";

export type StaffOption = { id: string; full_name: string };

const smallButton = "rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-canvas disabled:opacity-60";

/** Agendar entrevista Prime o con cliente, siempre por Teams. Con Outlook conectado (Mi cuenta) el enlace lo genera el sistema; si no, se pega a mano. */
export function ScheduleInterviewForm({ applicationId, staff, currentUserId, defaultType, open = false, outlookConnected }: { applicationId: string; staff: StaffOption[]; currentUserId: string; defaultType: Enums<"interview_type">; open?: boolean; outlookConnected: boolean }) {
  const [state, action, pending] = useActionState(scheduleInterview, undefined);
  const [type, setType] = useState<Enums<"interview_type">>(defaultType);

  return (
    <details open={open} className="rounded-card border border-line bg-surface shadow-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-semibold text-forest">
        <CalendarPlus className="h-4 w-4" /> Agendar entrevista
      </summary>
      <form action={action} className="grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="application_id" value={applicationId} />
        <label className={labelClass}>
          Tipo
          <select name="type" value={type} onChange={(e) => setType(e.target.value as Enums<"interview_type">)} className={inputClass}>
            <option value="prime">Entrevista Prime</option>
            <option value="client">Entrevista con cliente</option>
          </select>
        </label>
        <label className={labelClass}>
          Fecha
          <input name="date" type="date" required className={inputClass} />
        </label>
        <label className={labelClass}>
          Hora
          <input name="time" type="time" required step={300} className={inputClass} />
        </label>
        <label className={labelClass}>
          Duración (min)
          <input name="duration_min" type="number" min={10} max={240} step={5} defaultValue={30} className={inputClass} />
        </label>
        {outlookConnected ? (
          <p className="rounded-lg bg-mint px-3 py-2 text-sm text-forest sm:col-span-2 lg:col-span-3">
            Se crea en tu Outlook con enlace de Teams, se invita al candidato (si tiene correo) y a Fireflies para grabarla.
          </p>
        ) : (
          <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>
            Enlace de Teams
            <input name="meeting_url" type="url" placeholder="https://teams.microsoft.com/…" className={inputClass} />
            <span className="mt-1 block text-xs font-normal text-ink-faint">
              Conecta tu Outlook en{" "}
              <a href="/mi-cuenta" className="font-medium text-forest hover:underline">
                Mi cuenta
              </a>{" "}
              y el evento, el enlace y la invitación a Fireflies salen solos.
            </span>
          </label>
        )}
        {type === "prime" ? (
          <label className={labelClass}>
            Entrevistador
            <select name="interviewer_user_id" defaultValue={staff.some((s) => s.id === currentUserId) ? currentUserId : ""} className={inputClass}>
              <option value="">Yo</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className={labelClass}>
            Quién entrevista (cliente)
            <input name="client_interviewer_name" type="text" maxLength={120} placeholder="Nombre y puesto" className={inputClass} />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2 lg:col-span-3">
          <input name="advance" type="checkbox" defaultChecked className="h-4 w-4 rounded border-line accent-forest" />
          Mover al candidato a la etapa {type === "prime" ? "Entrevista Prime" : "Entrevista con cliente"} si va antes
        </label>
        <div className="flex items-end justify-end">
          <button type="submit" disabled={pending} className={`${buttonPrimaryClass} mt-0 w-auto`}>
            {pending ? "Agendando…" : "Agendar"}
          </button>
        </div>
        {state?.error && (
          <p role="alert" className={`${alertErrorClass} sm:col-span-2 lg:col-span-4`}>
            {state.error}
          </p>
        )}
      </form>
    </details>
  );
}

type InterviewSnapshot = { id: string; status: Enums<"interview_status">; date: string; time: string; meetingUrl: string | null; summary: string | null; score: number | null };

/** Reagendar, confirmar, cancelar, marcar que no se presentó, o cerrar como realizada con notas y calificación. */
export function InterviewActions({ applicationId, interview: iv }: { applicationId: string; interview: InterviewSnapshot }) {
  const [panel, setPanel] = useState<"none" | "reschedule" | "notes">("none");
  // al guardar bien se cierra el panel; la tarjeta ya viene con los datos nuevos
  const closing =
    <S extends { ok?: boolean } | undefined>(fn: (prev: S, fd: FormData) => Promise<S>) =>
    async (prev: S, fd: FormData) => {
      const result = await fn(prev, fd);
      if (result?.ok) setPanel("none");
      return result;
    };
  const [reState, reAction, rePending] = useActionState(closing(rescheduleInterview), undefined);
  const [stState, stAction, stPending] = useActionState(closing(setInterviewStatus), undefined);

  const live = iv.status === "scheduled" || iv.status === "confirmed";
  const canReschedule = live || iv.status === "no_show" || iv.status === "cancelled";
  const canNote = live || iv.status === "completed";
  if (!canReschedule && !canNote) return null; // grabada, transcrita o analizada: ya es de Fireflies y la IA

  const ids = (
    <>
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="interview_id" value={iv.id} />
    </>
  );

  return (
    <div className="mt-5 space-y-3 border-t border-line pt-4">
      <div className="flex flex-wrap gap-2">
        {canReschedule && (
          <button type="button" onClick={() => setPanel(panel === "reschedule" ? "none" : "reschedule")} className={smallButton}>
            Reagendar
          </button>
        )}
        {canNote && (
          <button type="button" onClick={() => setPanel(panel === "notes" ? "none" : "notes")} className={smallButton}>
            {iv.status === "completed" ? "Editar notas" : "Marcar realizada"}
          </button>
        )}
        {live && (
          <form action={stAction} className="flex flex-wrap gap-2">
            {ids}
            <input type="hidden" name="summary" value="" />
            <input type="hidden" name="score" value="" />
            {iv.status === "scheduled" && (
              <button type="submit" name="status" value="confirmed" disabled={stPending} className={smallButton}>
                Confirmar
              </button>
            )}
            <button type="submit" name="status" value="no_show" disabled={stPending} className={smallButton}>
              No se presentó
            </button>
            <button type="submit" name="status" value="cancelled" disabled={stPending} className="rounded-lg px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60">
              Cancelar entrevista
            </button>
          </form>
        )}
      </div>

      {panel === "reschedule" && (
        <form action={reAction} className="grid gap-3 sm:grid-cols-4">
          {ids}
          <label className={labelClass}>
            Nueva fecha
            <input name="date" type="date" required defaultValue={iv.date} className={inputClass} />
          </label>
          <label className={labelClass}>
            Nueva hora
            <input name="time" type="time" required step={300} defaultValue={iv.time} className={inputClass} />
          </label>
          <label className={labelClass}>
            Enlace (si cambió)
            <input name="meeting_url" type="url" defaultValue={iv.meetingUrl ?? ""} className={inputClass} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={rePending} className={`${buttonPrimaryClass} mt-0 w-auto`}>
              {rePending ? "Guardando…" : "Guardar nueva fecha"}
            </button>
          </div>
        </form>
      )}

      {panel === "notes" && (
        <form action={stAction} className="grid gap-3 sm:grid-cols-4">
          {ids}
          <input type="hidden" name="status" value="completed" />
          <label className={`${labelClass} sm:col-span-3`}>
            Notas de la entrevista
            <textarea name="summary" rows={4} maxLength={4000} defaultValue={iv.summary ?? ""} placeholder="Qué se vio contra el perfil: experiencia, empresas donde trabajó y tiempo en cada una, actitud, pendientes." className={inputClass} />
          </label>
          <div className="space-y-3">
            <label className={labelClass}>
              Calificación (0 a 100)
              <input name="score" type="number" min={0} max={100} defaultValue={iv.score ?? ""} placeholder="Opcional" className={inputClass} />
            </label>
            <button type="submit" disabled={stPending} className={`${buttonPrimaryClass} mt-0`}>
              {stPending ? "Guardando…" : "Guardar como realizada"}
            </button>
          </div>
        </form>
      )}

      {(reState?.error || stState?.error) && (
        <p role="alert" className={alertErrorClass}>
          {reState?.error ?? stState?.error}
        </p>
      )}
      {(reState?.warning || stState?.warning) && (
        <p role="status" className="rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber">
          {reState?.warning ?? stState?.warning}
        </p>
      )}
    </div>
  );
}
