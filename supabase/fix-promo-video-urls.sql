-- Fix promo video URLs stored with localhost during local development.
-- Run once in Supabase SQL Editor after deploying the API to Render.

UPDATE public.promo_videos
SET
  video_url = regexp_replace(
    video_url,
    '^https?://[^/]+(/uploads/promo-videos/.+)$',
    'https://anti-tamper.onrender.com\1'
  ),
  updated_at = NOW()
WHERE video_url ~* '^https?://(localhost|127\.0\.0\.1)';

UPDATE public.promo_videos
SET
  poster_url = regexp_replace(
    poster_url,
    '^https?://[^/]+(/uploads/.+)$',
    'https://anti-tamper.onrender.com\1'
  ),
  updated_at = NOW()
WHERE poster_url ~* '^https?://(localhost|127\.0\.0\.1)';
