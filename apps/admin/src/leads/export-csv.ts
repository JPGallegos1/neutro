import {
  filterLeadsByStatus,
  type Lead,
  type LeadStatusFilter,
} from "@/leads/lead";

export const LEAD_CSV_MIN_COLUMNS = [
  "id",
  "source",
  "external_id",
  "status",
  "notes",
  "assignee",
  "sin_website",
  "tiene_redes",
] as const;

export type LeadCsvColumn = (typeof LEAD_CSV_MIN_COLUMNS)[number];

export type LeadCsvRow = Record<LeadCsvColumn, string>;

export const FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS = [
  "displayName",
  "formattedAddress",
  "rating",
  "openingHours",
  "google_display_name",
  "google_formatted_address",
  "google_rating",
  "google_opening_hours",
  "google_place_id",
] as const;

export function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function leadToCsvRow(lead: Lead): LeadCsvRow {
  return {
    id: lead.id,
    source: lead.source,
    external_id: lead.externalId,
    status: lead.status,
    notes: lead.notes,
    assignee: lead.assignee ?? "",
    sin_website: lead.website ? "0" : "1",
    tiene_redes: lead.socialUrls.length > 0 ? "1" : "0",
  };
}

export function exportLeadsCsv(leads: Lead[]): string {
  const header = LEAD_CSV_MIN_COLUMNS.join(",");
  const lines = leads.map((lead) => {
    const row = leadToCsvRow(lead);
    return LEAD_CSV_MIN_COLUMNS.map((col) => escapeCsv(row[col])).join(",");
  });
  return `${[header, ...lines].join("\n")}\n`;
}

export function csvHasForbiddenGooglePlacesColumns(csv: string): boolean {
  const header = (csv.split(/\r?\n/, 1)[0] ?? "").split(",");
  const forbidden = new Set<string>(FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS);
  return header.some((col) => forbidden.has(col.trim()));
}

export function leadCsvFitnessViolations(csv: string): string[] {
  const violations: string[] = [];
  const header = (csv.split(/\r?\n/, 1)[0] ?? "").split(",").map((c) => c.trim());
  for (const col of LEAD_CSV_MIN_COLUMNS) {
    if (!header.includes(col)) violations.push(`missing:${col}`);
  }
  if (csvHasForbiddenGooglePlacesColumns(csv)) {
    violations.push("forbidden_google_places_columns");
  }
  for (const col of header) {
    if ((FORBIDDEN_GOOGLE_PLACES_CSV_COLUMNS as readonly string[]).includes(col)) {
      violations.push(`google_col:${col}`);
    }
  }
  return violations;
}

export function leadsForCsvExport(
  leads: Lead[],
  filter: LeadStatusFilter,
): Lead[] {
  return filterLeadsByStatus(leads, filter);
}

export function blobFromLeadsCsv(csv: string): Blob {
  if (leadCsvFitnessViolations(csv).length > 0) {
    throw new Error("csv_fitness_failed");
  }
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export function createLeadsCsvDownload(
  leads: Lead[],
  filter: LeadStatusFilter,
): { blob: Blob; filename: string } {
  const csv = exportLeadsCsv(leadsForCsvExport(leads, filter));
  return { blob: blobFromLeadsCsv(csv), filename: "leads.csv" };
}
