import "server-only";
import { requireAdmin, requireStaff } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { MOCK_PIPELINE as MOCK } from "@/lib/mock";
import * as mock from "@/lib/mock/data";
import type { AiInsight, ChannelRow, DiscardReasonRow, FunnelRow, PrefilterFailureRow, ReportRun, StageDurationRow } from "./types";

export type BiFilters = { clientId?: string; profileId?: string };

const match = (f: BiFilters) => (r: { client_id: string | null; profile_id: string | null }) =>
  (!f.clientId || r.client_id === f.clientId) && (!f.profileId || r.profile_id === f.profileId);

async function biQuery<T>(table: "v_bi_funnel" | "v_bi_channel" | "v_bi_stage_durations" | "v_bi_discard_reasons" | "v_bi_prefilter_failures", f: BiFilters): Promise<T[]> {
  const supabase = await createClient();
  let query = supabase.from(table).select("*");
  if (f.clientId) query = query.eq("client_id", f.clientId);
  if (f.profileId) query = query.eq("profile_id", f.profileId);
  const { data, error } = await query;
  if (error) throw error;
  return data as T[];
}

export async function getFunnel(f: BiFilters = {}): Promise<FunnelRow[]> {
  await requireStaff();
  return MOCK ? mock.funnelRows.filter(match(f)) : biQuery<FunnelRow>("v_bi_funnel", f);
}

export async function getChannels(f: BiFilters = {}): Promise<ChannelRow[]> {
  await requireStaff();
  return MOCK ? mock.channelRows.filter(match(f)) : biQuery<ChannelRow>("v_bi_channel", f);
}

export async function getStageDurations(f: BiFilters = {}): Promise<StageDurationRow[]> {
  await requireStaff();
  return MOCK ? mock.stageDurationRows.filter(match(f)) : biQuery<StageDurationRow>("v_bi_stage_durations", f);
}

export async function getDiscardReasons(f: BiFilters = {}): Promise<DiscardReasonRow[]> {
  await requireStaff();
  return MOCK ? mock.discardRows.filter(match(f)) : biQuery<DiscardReasonRow>("v_bi_discard_reasons", f);
}

export async function getPrefilterFailures(f: BiFilters = {}): Promise<PrefilterFailureRow[]> {
  await requireStaff();
  return MOCK ? mock.prefilterFailureRows.filter(match(f)) : biQuery<PrefilterFailureRow>("v_bi_prefilter_failures", f);
}

export async function listReportRuns(limit = 30): Promise<(ReportRun & { client_name: string | null })[]> {
  await requireStaff();
  if (MOCK) {
    return mock.reportRuns
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((r) => ({ ...r, client_name: r.client_id ? mock.clientById(r.client_id).name : null }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("report_runs").select("*, clients(name)").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data.map(({ clients, ...r }) => ({ ...r, client_name: clients?.name ?? null }));
}

/** Inteligencia interna (solo admin). */
export async function listInsights(): Promise<(AiInsight & { client_name: string | null })[]> {
  await requireAdmin();
  if (MOCK) return mock.aiInsights.map((i) => ({ ...i, client_name: i.client_id ? mock.clientById(i.client_id).name : null }));
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_insights").select("*, clients(name)").order("week_start", { ascending: false }).limit(12);
  if (error) throw error;
  return data.map(({ clients, ...i }) => ({ ...i, client_name: clients?.name ?? null }));
}
