-- Token request + resend support (run in Supabase SQL Editor if needed)
ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS token_closed_at TIMESTAMPTZ;

ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS token_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.delivery_requests.token_closed_at IS
  'When customer locked the box — unlock token is consumed (one-time use)';

COMMENT ON COLUMN public.delivery_requests.token_requested_at IS
  'Customer asked for a new unlock code after expiry or use — manager/admin should resend';

-- Optional: approve all existing accounts (run once if users were stuck on "Pending approval")
UPDATE public.profiles
SET is_approved = TRUE,
    approved_at = COALESCE(approved_at, NOW())
WHERE is_approved = FALSE;
