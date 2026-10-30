import { useAdmin } from "@/admin-context";
import {
  seedOnNotesSelectLeadFromIdle,
  seedSelectLeadFromIdle,
  seedUpdateLeadRequestedFromIdle,
} from "@/admin-machine";
import { exportLeadsCsv } from "@/leads/export-csv";
import { getGoogleLiveClient } from "@/leads/google-live";
import { getLeadsClient, type LeadClientPatch } from "@/leads/leads-client";
import {
  LEAD_STATUSES,
  filterLeadsByStatus,
  leadMapsUrl,
  leadWhatsAppUrl,
  type Lead,
  type LeadStatus,
  type LeadStatusFilter,
} from "@/leads/lead";

const noteTimers = new Map<string, ReturnType<typeof setTimeout>>();
const press =
  "transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
const onChip =
  "bg-neutro-accent-orange text-neutro-on-orange rounded-md px-2.5 py-1.5 text-xs";
const offChip = "bg-neutro-bg text-neutro-text-muted rounded-md px-2.5 py-1.5 text-xs";
const FILTERS: LeadStatusFilter[] = ["todos", ...LEAD_STATUSES];
const label = (s: LeadStatus) =>
  ({ nuevo: "Nuevo", contactado: "Contactado", interesado: "Interesado", descartado: "Descartado" })[s];

export function LeadsPage({
  loadedLeads,
  loadedLeadsRevision,
}: {
  loadedLeads: Lead[];
  loadedLeadsRevision: number;
}) {
  const { state, dispatch } = useAdmin();
  const leads = state.leadsStatus === "idle" ? loadedLeads : state.leads;
  const visible = filterLeadsByStatus(leads, state.leadsStatusFilter);
  const selected =
    visible.find((l) => l.id === state.selectedLeadId) ??
    leads.find((l) => l.id === state.selectedLeadId) ??
    null;

  const idleSeed = { leads: loadedLeads, revision: loadedLeadsRevision };

  function onSelect(id: string) {
    dispatch(state.leadsStatus === "idle" ? seedSelectLeadFromIdle(id, idleSeed) : { type: "selectLead", id });
    const lead = leads.find((item) => item.id === id);
    if (!lead) return;
    dispatch({ type: "googleLiveRequested" });
    void getGoogleLiveClient()
      .fetchForLead({ name: lead.name, lat: lead.lat, lng: lead.lng })
      .then((live) =>
        dispatch(live ? { type: "googleLiveSucceeded", live } : { type: "googleLiveFailed" }),
      )
      .catch(() => dispatch({ type: "googleLiveFailed" }));
  }

  async function persist(id: string, patch: LeadClientPatch) {
    dispatch(state.leadsStatus === "idle" ? seedUpdateLeadRequestedFromIdle(idleSeed) : { type: "updateLeadRequested" });
    try {
      const body: LeadClientPatch = {};
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.notes !== undefined) body.notes = patch.notes;
      if (patch.assignAccessUser) body.assignAccessUser = true;
      const lead = await getLeadsClient().update(id, body);
      if (lead.assignee) dispatch({ type: "setAccessLabel", label: lead.assignee });
      const done: {
        type: "updateLeadSucceeded";
        lead: typeof lead;
        revision: number;
        committedNotes?: string;
      } = { type: "updateLeadSucceeded", lead, revision: Date.now() };
      if (patch.notes !== undefined) done.committedNotes = patch.notes;
      dispatch(done);
    } catch {
      dispatch({ type: "updateLeadFailed" });
    }
  }

  function onNotes(notes: string) {
    if (!selected) return;
    if (state.leadsStatus === "idle") dispatch(seedOnNotesSelectLeadFromIdle(selected.id, idleSeed));
    dispatch({ type: "leadNotesChanged", id: selected.id, notes });
    const prev = noteTimers.get(selected.id);
    if (prev) clearTimeout(prev);
    const id = selected.id;
    noteTimers.set(id, setTimeout(() => void persist(id, { notes }), 400));
  }

  function onExportCsv() {
    const csv = exportLeadsCsv(visible);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leads.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-1 flex-col gap-4 p-6" data-admin-leads-page aria-label="Leads">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Leads</h1>
          <p className="text-sm text-neutro-text-muted">Seguimiento por estado, notas y responsable</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-neutro-text-muted" data-admin-leads-count>
            {visible.length} leads
          </p>
          <button
            type="button"
            data-admin-leads-export
            className={`rounded-md bg-neutro-accent-orange px-3 py-2 text-sm text-neutro-on-orange ${press}`}
            onClick={onExportCsv}
          >
            Exportar CSV
          </button>
        </div>
      </header>
      <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Filtro por estado">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            data-admin-leads-filter={filter}
            aria-pressed={state.leadsStatusFilter === filter}
            className={`${press} rounded-md px-3 py-1.5 ${
              state.leadsStatusFilter === filter
                ? "bg-neutro-accent-orange text-neutro-on-orange"
                : "bg-neutro-surface text-neutro-text-muted [@media(hover:hover)]:hover:opacity-90"
            }`}
            onClick={() => dispatch({ type: "setLeadsStatusFilter", filter })}
          >
            {filter === "todos" ? "Todos" : label(filter)}
          </button>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ul className="flex max-h-[32rem] flex-col gap-2 overflow-auto" data-admin-leads-list>
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-admin-lead-id={item.id}
                aria-pressed={item.id === state.selectedLeadId}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${press} ${
                  item.id === state.selectedLeadId
                    ? "bg-neutro-surface text-neutro-text"
                    : "bg-neutro-bg text-neutro-text-muted"
                }`}
                onClick={() => onSelect(item.id)}
              >
                <span className="font-medium text-neutro-text">{item.name}</span>
                <span className="block text-xs">
                  {label(item.status)}
                  {item.assignee ? ` · ${item.assignee}` : ""}
                  {item.website ? "" : " · sin website"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <aside className="flex flex-col gap-4 rounded-md bg-neutro-surface p-4" data-admin-lead-ficha aria-label="Ficha del Lead">
          {selected ? (
            <>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium tracking-tight">{selected.name}</h2>
                <p className="text-xs text-neutro-text-muted">
                  {selected.source} · {selected.externalId}
                </p>
                {selected.address ? <p className="text-sm text-neutro-text-muted">{selected.address}</p> : null}
                <p className="text-xs text-neutro-text-muted">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Estado del lead">
                {LEAD_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    data-admin-lead-status={status}
                    aria-pressed={selected.status === status}
                    className={`${press} ${selected.status === status ? onChip : offChip}`}
                    onClick={() => void persist(selected.id, { status })}
                  >
                    {label(status)}
                  </button>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-sm">
                Notas
                <textarea
                  data-admin-lead-notes
                  className="min-h-24 rounded-md bg-neutro-bg px-3 py-2 text-sm ring-1 ring-neutro-border focus:ring-2 focus:ring-neutro-accent-blue"
                  value={selected.notes}
                  onChange={(e) => onNotes(e.target.value)}
                />
              </label>
              <div className="flex flex-col gap-2 text-sm">
                <p data-admin-lead-assignee className="text-neutro-text-muted">
                  Responsable: {selected.assignee ?? "sin asignar"}
                </p>
                <button
                  type="button"
                  className={`self-start rounded-md bg-neutro-bg px-3 py-2 text-sm ${press}`}
                  onClick={() => void persist(selected.id, { assignAccessUser: true })}
                >
                  Asignarme (Access)
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a data-admin-lead-maps className="rounded-md bg-neutro-bg px-3 py-2 text-sm" href={leadMapsUrl(selected)} target="_blank" rel="noreferrer">
                  Abrir Maps
                </a>
                <a data-admin-lead-whatsapp className="rounded-md bg-neutro-bg px-3 py-2 text-sm" href={leadWhatsAppUrl(selected)} target="_blank" rel="noreferrer">
                  Abrir WhatsApp
                </a>
              </div>
              <div className="flex flex-col gap-2 rounded-md bg-neutro-bg p-3" data-admin-google-live>
                <p className="text-sm font-medium">Vista en vivo (Google Places)</p>
                {state.googleLiveStatus === "loading" ? <p className="text-xs text-neutro-text-muted">Consultando…</p> : null}
                {state.googleLiveStatus === "error" ? <p className="text-xs text-neutro-text-muted">No se pudo cargar la vista en vivo.</p> : null}
                {state.googleLive ? (
                  <div className="flex flex-col gap-1 text-xs text-neutro-text-muted">
                    <p>{state.googleLive.displayName}</p>
                    <p>{state.googleLive.formattedAddress}</p>
                    {state.googleLive.rating != null ? <p>Rating {state.googleLive.rating}</p> : null}
                    {state.googleLive.openingHours.map((line) => <p key={line}>{line}</p>)}
                    <p className="text-[10px]">Solo presentación · no se guarda en D1</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-neutro-text-muted">Elegí un Lead para ver la ficha.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
