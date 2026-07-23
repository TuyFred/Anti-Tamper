-- Rwanda administrative locations (Province → District → Sector → Cell → Village)
-- Run AFTER schema.sql and delivery-system.sql in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.rwanda_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  province TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  cell TEXT NOT NULL DEFAULT '',
  village TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL CHECK (level IN ('province', 'district', 'sector', 'cell', 'village')),
  UNIQUE (province, district, sector, cell, village)
);

CREATE INDEX IF NOT EXISTS idx_rwanda_locations_province ON public.rwanda_locations(province);
CREATE INDEX IF NOT EXISTS idx_rwanda_locations_district ON public.rwanda_locations(province, district);
CREATE INDEX IF NOT EXISTS idx_rwanda_locations_sector ON public.rwanda_locations(province, district, sector);

ALTER TABLE public.rwanda_locations ENABLE ROW LEVEL SECURITY;

-- Public read (locations are reference data)
DROP POLICY IF EXISTS "Anyone can read rwanda locations" ON public.rwanda_locations;
CREATE POLICY "Anyone can read rwanda locations"
  ON public.rwanda_locations FOR SELECT
  USING (true);

-- ============================================================
-- SEED — optional reference rows (app uses client/src/data/rwandaAdmin.js by default)
-- Add provinces/villages here only if you want GET /api/locations/rwanda from DB.
-- Delivery pickup/delivery coordinates come from the map pin — not from this table.
-- ============================================================
-- (no seed rows — locations are captured live on the map)
