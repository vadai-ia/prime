import { CHANNEL_LABELS, PIPELINE_STAGES, STAGE_LABELS, type Stage } from "@/lib/labels";
import type { ClientSummary, ProfileSummary, SourceChannel } from "@/lib/queries/types";
import { ClientProfileSelects } from "./client-profile-selects";

const selectClass =
  "rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/25";

export type PipelineFilterValues = {
  profileId?: string;
  clientId?: string;
  stage?: Stage;
  channel?: SourceChannel;
  search?: string;
  view: "kanban" | "lista";
};

/** Formulario GET: funciona sin JavaScript y deja los filtros en la URL. */
export function Filters({ values, profiles, clients }: { values: PipelineFilterValues; profiles: ProfileSummary[]; clients: ClientSummary[] }) {
  return (
    <form action="/candidatos" method="get" className="mb-5 flex flex-wrap items-center gap-2">
      <input type="hidden" name="view" value={values.view} />
      <ClientProfileSelects clients={clients} profiles={profiles} clientId={values.clientId} profileId={values.profileId} className={selectClass} />
      <select name="stage" defaultValue={values.stage ?? ""} className={selectClass} aria-label="Etapa">
        <option value="">Todas las etapas</option>
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
        <option value="discarded">{STAGE_LABELS.discarded}</option>
      </select>
      <select name="channel" defaultValue={values.channel ?? ""} className={selectClass} aria-label="Canal">
        <option value="">Todos los canales</option>
        {(Object.keys(CHANNEL_LABELS) as SourceChannel[]).map((c) => (
          <option key={c} value={c}>
            {CHANNEL_LABELS[c]}
          </option>
        ))}
      </select>
      <input
        type="search"
        name="q"
        defaultValue={values.search ?? ""}
        placeholder="Buscar por nombre"
        className={`${selectClass} min-w-48 placeholder:text-ink-faint`}
        aria-label="Buscar"
      />
      <button type="submit" className="rounded-lg bg-forest px-3.5 py-2 text-sm font-medium text-on-forest transition hover:bg-forest-deep">
        Filtrar
      </button>
      {(values.profileId || values.clientId || values.stage || values.channel || values.search) && (
        <a href={`/candidatos?view=${values.view}`} className="text-sm text-ink-muted underline-offset-2 hover:text-forest hover:underline">
          Limpiar
        </a>
      )}
    </form>
  );
}
