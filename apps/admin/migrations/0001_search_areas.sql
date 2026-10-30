CREATE TABLE IF NOT EXISTS search_areas (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  radius_km REAL NOT NULL,
  shape TEXT NOT NULL CHECK (shape IN ('circle', 'polygon')),
  polygon_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_areas_created_at ON search_areas (created_at);
INSERT OR IGNORE INTO search_areas (
  id, name, center_lat, center_lng, radius_km, shape, polygon_json, created_at, updated_at
) VALUES (
  'area_rosario_centro_3km', 'Rosario centro · 3 km', -32.9442, -60.6505, 3,
  'circle', NULL, '2026-10-30T00:00:00.000Z', '2026-10-30T00:00:00.000Z'
);
