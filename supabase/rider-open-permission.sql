-- Rider open permission (run in Supabase SQL Editor)
-- Assigned riders may track the box, but only open after admin/manager grants permission.

ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS rider_unlock_granted_at TIMESTAMPTZ;

ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS rider_unlock_granted_by UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.delivery_requests.rider_unlock_granted_at IS
  'When admin/manager granted the assigned rider permission to open the Smart Box';

COMMENT ON COLUMN public.delivery_requests.rider_unlock_granted_by IS
  'Admin/manager who granted rider open permission';
