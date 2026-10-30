import type { Comercio } from "@/comercio";
import type {
  D1DatabaseLike,
  D1PreparedStatement,
} from "@/d1-search-area-repository";
import {
  createLeadFromComercio,
  leadKey,
  type Lead,
  type LeadRepository,
  type LeadStatus,
} from "@/leads/lead";

type PlaceRow = {
  id: string;
  source: string;
  external_id: string;
  name: string;
  lat: number;
  lng: number;
  website: string | null;
  address: string | null;
  social_urls_json: string;
  rubro: string;
  attribution: string;
  created_at: string;
  updated_at: string;
};

type LeadRow = {
  id: string;
  place_id: string;
  status: string;
  notes: string;
  assignee: string | null;
  created_at: string;
  updated_at: string;
  source: string;
  external_id: string;
  name: string;
  lat: number;
  lng: number;
  website: string | null;
  address: string | null;
  social_urls_json: string;
  rubro: string;
  attribution: string;
};

function parseSocialUrls(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function toLead(row: LeadRow): Lead {
  const status = (
    ["nuevo", "contactado", "interesado", "descartado"] as const
  ).includes(row.status as LeadStatus)
    ? (row.status as LeadStatus)
    : "nuevo";
  return {
    id: row.id,
    source: row.source === "foursquare" ? "foursquare" : "osm",
    externalId: row.external_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    website: row.website,
    address: row.address,
    socialUrls: parseSocialUrls(row.social_urls_json),
    rubro: row.rubro as Lead["rubro"],
    attribution: row.attribution,
    status,
    notes: row.notes,
    assignee: row.assignee,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LEAD_SELECT = `SELECT leads.id, leads.place_id, leads.status, leads.notes, leads.assignee, leads.created_at, leads.updated_at,
  places.source, places.external_id, places.name, places.lat, places.lng, places.website, places.address, places.social_urls_json, places.rubro, places.attribution
  FROM leads INNER JOIN places ON places.id = leads.place_id`;

export function createD1LeadRepository(db: D1DatabaseLike): LeadRepository {
  return {
    async list() {
      const result = await db
        .prepare(`${LEAD_SELECT} ORDER BY leads.created_at ASC`)
        .all<LeadRow>();
      return result.results.map(toLead);
    },
    async saveFromComercios(comercios: Comercio[]) {
      const out: Lead[] = [];
      const seen = new Set<string>();
      for (const comercio of comercios) {
        const key = leadKey(comercio);
        if (seen.has(key)) continue;
        seen.add(key);
        const now = new Date().toISOString();
        const placeId = `place_${comercio.source}_${comercio.externalId}`;
        await db
          .prepare(
            `INSERT INTO places (id, source, external_id, name, lat, lng, website, address, social_urls_json, rubro, attribution, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(source, external_id) DO UPDATE SET
               name=excluded.name, lat=excluded.lat, lng=excluded.lng, website=excluded.website,
               address=excluded.address, social_urls_json=excluded.social_urls_json,
               rubro=excluded.rubro, attribution=excluded.attribution, updated_at=excluded.updated_at`,
          )
          .bind(
            placeId,
            comercio.source,
            comercio.externalId,
            comercio.name,
            comercio.lat,
            comercio.lng,
            comercio.website,
            comercio.address,
            JSON.stringify(comercio.socialUrls),
            comercio.rubro,
            comercio.attribution,
            now,
            now,
          )
          .run();
        const place = await db
          .prepare(
            `SELECT id, source, external_id, name, lat, lng, website, address, social_urls_json, rubro, attribution, created_at, updated_at
             FROM places WHERE source = ? AND external_id = ? LIMIT 1`,
          )
          .bind(comercio.source, comercio.externalId)
          .first<PlaceRow>();
        if (!place) continue;
        const existing = await db
          .prepare(`${LEAD_SELECT} WHERE places.id = ? LIMIT 1`)
          .bind(place.id)
          .first<LeadRow>();
        if (existing) {
          out.push(toLead(existing));
          continue;
        }
        const lead = createLeadFromComercio(comercio, {
          id: `lead_${place.id}`,
          now,
        });
        await db
          .prepare(
            `INSERT INTO leads (id, place_id, status, notes, assignee, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            lead.id,
            place.id,
            lead.status,
            lead.notes,
            lead.assignee,
            lead.createdAt,
            lead.updatedAt,
          )
          .run();
        out.push(lead);
      }
      return out;
    },
  };
}

export type { D1PreparedStatement };
