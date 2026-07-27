-- One-time unlock token lifecycle: token expires after customer closes the box.
ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS token_closed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.delivery_requests.token_closed_at IS
  'When customer locked the box — unlock token is consumed (one-time use)';
