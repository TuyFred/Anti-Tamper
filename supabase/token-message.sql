-- Track when unlock token was delivered to the customer's inbox
ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS token_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.delivery_requests.token_sent_at IS
  'When the unlock token message was sent to the customer dashboard/inbox';
