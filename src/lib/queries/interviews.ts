import "server-only";
import { requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import type { InterviewRow } from "./types";

export type InterviewScope = "upcoming" | "past" | "all";

/** Agenda de entrevistas Prime y con cliente, con candidato, vacante y entrevistador. */
export async function listInterviews(scope: InterviewScope = "all"): Promise<InterviewRow[]> {
  await requireStaff();
  const now = new Date().toISOString();
  const inScope = (r: InterviewRow) =>
    scope === "all" || (scope === "upcoming" ? (r.scheduled_at ?? "") >= now && r.status !== "cancelled" : (r.scheduled_at ?? "") < now);

  if (MOCK) {
    return mock.interviews
      .map((i): InterviewRow => {
        const app = mock.applications.find((a) => a.id === i.application_id)!;
        const c = mock.candidates.find((x) => x.id === app.candidate_id)!;
        const p = mock.profileById(app.profile_id);
        return { ...i, candidate_name: c.full_name, profile_title: p.title, client_name: mock.clientById(p.client_id).name, interviewer_name: mock.usersById(i.interviewer_user_id)?.full_name ?? null, stage: app.stage };
      })
      .filter(inScope)
      .sort((a, b) => (scope === "past" ? (b.scheduled_at ?? "").localeCompare(a.scheduled_at ?? "") : (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interviews")
    .select("*, applications!inner(stage, candidates(full_name), job_profiles(title, clients(name))), users!interviews_interviewer_user_id_fkey(full_name)")
    .order("scheduled_at", { ascending: scope !== "past" });
  if (error) throw error;
  return data
    .map(({ applications, users, ...i }): InterviewRow => ({
      ...i,
      candidate_name: applications.candidates?.full_name ?? "",
      profile_title: applications.job_profiles?.title ?? "",
      client_name: applications.job_profiles?.clients?.name ?? "",
      interviewer_name: users?.full_name ?? null,
      stage: applications.stage,
    }))
    .filter(inScope);
}
