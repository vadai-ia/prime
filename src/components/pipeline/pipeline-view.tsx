"use client";

import type { PipelineRow } from "@/lib/queries/types";
import type { Stage } from "@/lib/labels";
import { Kanban } from "./kanban";
import { PipelineList } from "./list";

export function PipelineView({ rows, view, stageFilter }: { rows: PipelineRow[]; view: "kanban" | "lista"; stageFilter?: Stage }) {
  if (view === "lista") return <PipelineList rows={rows} />;
  return <Kanban rows={rows} onlyStage={stageFilter} />;
}
