-- Migration: add history & report tables to an existing database.
-- Safe to run if full-setup.sql PART 6 was not applied yet.

INSERT INTO public.permissions (name, description) VALUES
  ('reports.view', 'View activity history and audit logs'),
  ('reports.generate', 'Generate and download PDF reports')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name IN ('admin', 'manager')
  AND p.name IN ('reports.view', 'reports.generate')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'delivery', 'device', 'payment', 'user', 'alert', 'report', 'system'
  )),
  entity_id UUID,
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary TEXT,
  old_value JSONB DEFAULT '{}',
  new_value JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('submitted', 'verified', 'rejected', 'cancelled')),
  amount NUMERIC(12, 2),
  currency TEXT DEFAULT 'RWF',
  payment_method TEXT,
  proof_url TEXT,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.device_gps_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'mqtt' CHECK (source IN ('mqtt', 'manual', 'system')),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type TEXT NOT NULL CHECK (report_type IN (
    'deliveries_summary', 'financial', 'activity', 'delivery_detail', 'alerts_summary'
  )),
  title TEXT NOT NULL,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  filters JSONB DEFAULT '{}',
  record_count INTEGER DEFAULT 0,
  file_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery ON public.delivery_status_history(delivery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_delivery ON public.payment_events(delivery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_gps_history_device ON public.device_gps_history(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created ON public.generated_reports(created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_gps_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view activity log" ON public.activity_log;
CREATE POLICY "Managers can view activity log" ON public.activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Managers can view delivery status history" ON public.delivery_status_history;
CREATE POLICY "Managers can view delivery status history" ON public.delivery_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.delivery_requests dr
      WHERE dr.id = delivery_status_history.delivery_id AND dr.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can view payment events" ON public.payment_events;
CREATE POLICY "Managers can view payment events" ON public.payment_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.delivery_requests dr
      WHERE dr.id = payment_events.delivery_id AND dr.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users with device access can view GPS history" ON public.device_gps_history;
CREATE POLICY "Users with device access can view GPS history" ON public.device_gps_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name IN ('admin', 'manager')
    )
    OR EXISTS (
      SELECT 1 FROM public.device_access da
      WHERE da.device_id = device_gps_history.device_id AND da.user_id = auth.uid() AND da.can_view = TRUE
    )
  );

DROP POLICY IF EXISTS "Managers can view generated reports" ON public.generated_reports;
CREATE POLICY "Managers can view generated reports" ON public.generated_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name IN ('admin', 'manager')
    )
  );

CREATE OR REPLACE FUNCTION public.set_delivery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delivery_requests_updated ON public.delivery_requests;
CREATE TRIGGER trg_delivery_requests_updated
  BEFORE UPDATE ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_delivery_updated_at();
