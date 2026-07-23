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
-- SEED — City of Kigali (sample; app also ships client/src/data/rwandaAdmin.js)
-- ============================================================
INSERT INTO public.rwanda_locations (province, district, sector, cell, village, level) VALUES
  ('City of Kigali', '', '', '', '', 'province'),
  ('Eastern Province', '', '', '', '', 'province'),
  ('Northern Province', '', '', '', '', 'province'),
  ('Southern Province', '', '', '', '', 'province'),
  ('Western Province', '', '', '', '', 'province')
ON CONFLICT DO NOTHING;

-- Gasabo — Kimironko
INSERT INTO public.rwanda_locations (province, district, sector, cell, village, level) VALUES
  ('City of Kigali', 'Gasabo', 'Kimironko', 'Kibagabaga', 'Ubumwe', 'village'),
  ('City of Kigali', 'Gasabo', 'Kimironko', 'Kibagabaga', 'Amahoro', 'village'),
  ('City of Kigali', 'Gasabo', 'Kimironko', 'Kibagabaga', 'Nyagatovu', 'village'),
  ('City of Kigali', 'Gasabo', 'Remera', 'Rukiri', 'Amahoro', 'village'),
  ('City of Kigali', 'Gasabo', 'Remera', 'Rukiri', 'Ubumwe', 'village'),
  ('City of Kigali', 'Gasabo', 'Kacyiru', 'Kamatamu', 'Ubumwe', 'village'),
  ('City of Kigali', 'Kicukiro', 'Kicukiro', 'Ngoma', 'Ubumwe', 'village'),
  ('City of Kigali', 'Kicukiro', 'Gikondo', 'Kanserege', 'Amahoro', 'village'),
  ('City of Kigali', 'Nyarugenge', 'Nyarugenge', 'Nyamirambo', 'Ubumwe', 'village'),
  ('City of Kigali', 'Nyarugenge', 'Muhima', 'Muhima', 'Ubumwe', 'village'),
  ('City of Kigali', 'Nyarugenge', 'Kimisagara', 'Kimisagara', 'Amahoro', 'village')
ON CONFLICT DO NOTHING;

-- Eastern Province samples
INSERT INTO public.rwanda_locations (province, district, sector, cell, village, level) VALUES
  ('Eastern Province', 'Bugesera', 'Nyamata', 'Nyamata', 'Nyamata I', 'village'),
  ('Eastern Province', 'Rwamagana', 'Rwamagana', 'Rwamagana', 'Ubumwe', 'village'),
  ('Eastern Province', 'Kayonza', 'Kayonza', 'Kayonza', 'Ubumwe', 'village')
ON CONFLICT DO NOTHING;
