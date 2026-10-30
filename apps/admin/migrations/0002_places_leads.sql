CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('foursquare', 'osm')),
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  website TEXT,
  address TEXT,
  social_urls_json TEXT NOT NULL DEFAULT '[]',
  rubro TEXT NOT NULL,
  attribution TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_places_source_external ON places (source, external_id);
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY NOT NULL,
  place_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('nuevo', 'contactado', 'interesado', 'descartado')),
  notes TEXT NOT NULL DEFAULT '',
  assignee TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (place_id) REFERENCES places (id)
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
