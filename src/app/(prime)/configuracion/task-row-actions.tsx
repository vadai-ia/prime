"use client";

import { useActionState } from "react";
import { updateTask } from "@/actions/tasks";
import type { Enums } from "@/lib/db/types";

export function TaskRowActions({ taskId, status }: { taskId: string; status: Enums<"task_status"> }) {
  const [state, action, pending] = useActionState(updateTask, undefined);
  if (status !== "failed" && status !== "pending") return null;
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="task_id" value={taskId} />
      <button
        type="submit"
        name="op"
        value={status === "failed" ? "retry" : "cancel"}
        disabled={pending}
        className={`rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium transition hover:bg-canvas disabled:opacity-60 ${status === "failed" ? "text-ink" : "text-danger"}`}
      >
        {pending ? "…" : status === "failed" ? "Reintentar" : "Cancelar"}
      </button>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
