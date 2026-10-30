export type GoogleLiveView = {
  displayName: string; formattedAddress: string; rating: number | null;
  openingHours: string[]; fetchedAt: string;
};
export type GoogleLiveQuery = { name: string; lat: number; lng: number };
export type GoogleLiveClient = { fetchForLead(query: GoogleLiveQuery): Promise<GoogleLiveView | null> };

export function googleLiveDoesNotTouchPlaces(): true {
  return true;
}

export function createFixtureGoogleLiveView(
  query: GoogleLiveQuery,
  now = new Date().toISOString(),
): GoogleLiveView {
  return {
    displayName: `Google · ${query.name}`,
    formattedAddress: `Vista Google cerca de ${query.lat.toFixed(4)}, ${query.lng.toFixed(4)}`,
    rating: 4.2,
    openingHours: ["lun–vie 09:00–18:00", "sáb 10:00–14:00"],
    fetchedAt: now,
  };
}

export function createFixtureGoogleLiveClient(): GoogleLiveClient {
  return {
    async fetchForLead(query) {
      if (!Number.isFinite(query.lat) || !Number.isFinite(query.lng)) return null;
      return createFixtureGoogleLiveView(query);
    },
  };
}

export function createHttpGoogleLiveClient(baseUrl = ""): GoogleLiveClient {
  return {
    async fetchForLead(query) {
      const q = new URLSearchParams({
        lat: String(query.lat),
        lng: String(query.lng),
        name: query.name,
      });
      const res = await fetch(`${baseUrl}/api/google-live?${q}`);
      if (!res.ok) throw new Error(`google_live_failed_${res.status}`);
      return ((await res.json()) as { live: GoogleLiveView }).live;
    },
  };
}

let active: GoogleLiveClient | null = null;
export const setGoogleLiveClient = (c: GoogleLiveClient) => {
  active = c;
};
export const getGoogleLiveClient = () => {
  if (!active) throw new Error("google_live_client_missing");
  return active;
};
