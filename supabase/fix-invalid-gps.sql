-- Remove wrong GPS (e.g. Paris 48.85, 2.35) — keep only coordinates inside Rwanda
-- Run in Supabase SQL Editor after deploying GPS validation

UPDATE public.devices
SET
  latitude = NULL,
  longitude = NULL,
  updated_at = NOW()
WHERE
  latitude IS NOT NULL
  AND (
    latitude < -2.84 OR latitude > -1.05
    OR longitude < 28.86 OR longitude > 30.92
  );

-- Optional: clear GPS history outside Rwanda
DELETE FROM public.gps_history
WHERE latitude < -2.84 OR latitude > -1.05
   OR longitude < 28.86 OR longitude > 30.92;
