-- =============================================================================
-- Anti-Tamper Smart Delivery Box Platform — FULL SUPABASE SETUP
-- =============================================================================
-- Run this ONCE in Supabase → SQL Editor (fresh project or empty public schema).
--
-- Includes:
--   1. Core schema (roles, profiles, devices, alerts)
--   2. Delivery system (deliveries, reviews, promo videos)
--   3. Rwanda locations table (empty — map pins + live GPS only)
--   4. Default admin user
--   5. Token message column + promo URL fix (safe if already applied)
--   6. History, audit logs & PDF report tracking
--
-- No demo device or fixed GPS seeds. Register boxes in Admin; ESP32 sends live coords.
-- Already have old seeds? Run supabase/remove-seed-data.sql
--
-- Default admin after run:
--   Email:    admin@system.com
--   Password: admin123@
--
-- Production API URL for promo videos (edit if your Render URL differs):
--   https://anti-tamper.onrender.com
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- PART 1 — CORE SCHEMA (schema.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Full system access, user approval, device management'),
  ('operator', 'Can view and control assigned devices'),
  ('viewer', 'Read-only access to assigned devices')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.permissions (name, description) VALUES
  ('users.approve', 'Approve pending user registrations'),
  ('users.manage', 'Manage all users and roles'),
  ('devices.view', 'View device status and location'),
  ('devices.control', 'Send commands to devices (unlock, buzzer)'),
  ('devices.manage', 'Register and configure devices'),
  ('alerts.view', 'View alert history'),
  ('alerts.acknowledge', 'Acknowledge and resolve alerts')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'operator' AND p.name IN ('devices.view', 'devices.control', 'alerts.view', 'alerts.acknowledge')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'viewer' AND p.name IN ('devices.view', 'alerts.view')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role_id UUID REFERENCES public.roles(id),
  is_approved BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  tamper_status BOOLEAN DEFAULT FALSE,
  shock_detected BOOLEAN DEFAULT FALSE,
  buzzer_active BOOLEAN DEFAULT FALSE,
  led_active BOOLEAN DEFAULT FALSE,
  lock_status TEXT DEFAULT 'locked' CHECK (lock_status IN ('locked', 'unlocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.device_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_control BOOLEAN DEFAULT FALSE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('gps', 'tamper', 'shock', 'unauthorized', 'system')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  metadata JSONB DEFAULT '{}',
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_device ON public.alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON public.alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin' AND p.is_approved = TRUE
    )
  );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin' AND p.is_approved = TRUE
    )
  );

DROP POLICY IF EXISTS "Users with access can view devices" ON public.devices;
CREATE POLICY "Users with access can view devices" ON public.devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.device_access da
      WHERE da.device_id = devices.id AND da.user_id = auth.uid() AND da.can_view = TRUE
    )
  );

DROP POLICY IF EXISTS "Users with access can view alerts" ON public.alerts;
CREATE POLICY "Users with access can view alerts" ON public.alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.device_access da
      WHERE da.device_id = alerts.device_id AND da.user_id = auth.uid() AND da.can_view = TRUE
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read permissions" ON public.permissions;
CREATE POLICY "Authenticated users can read permissions" ON public.permissions
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "Users can view own device access" ON public.device_access;
CREATE POLICY "Users can view own device access" ON public.device_access
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage device access" ON public.device_access;
CREATE POLICY "Admins can manage device access" ON public.device_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin' AND p.is_approved = TRUE
    )
  );

CREATE OR REPLACE FUNCTION public.user_has_permission(user_uuid UUID, perm_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE p.id = user_uuid AND p.is_approved = TRUE AND perm.name = perm_name
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- No demo device seed — register Smart Boxes in Admin; GPS comes from live ESP32 capture.

-- =============================================================================
-- PART 2 — DELIVERY SYSTEM (delivery-system.sql)
-- =============================================================================

INSERT INTO public.roles (name, description) VALUES
  ('customer', 'Requests deliveries, pays, unlocks box with token, leaves reviews'),
  ('manager', 'Approves accounts, verifies payments, assigns riders, controls boxes'),
  ('motor_rider', 'Receives assignments and delivers Smart Boxes')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.permissions (name, description) VALUES
  ('deliveries.create', 'Create delivery requests'),
  ('deliveries.view_own', 'View own delivery requests'),
  ('deliveries.manage', 'Manage all deliveries, verify payments, assign riders'),
  ('deliveries.assign', 'View and update assigned deliveries as rider'),
  ('reviews.create', 'Submit delivery reviews and ratings')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'manager'
  AND p.name IN (
    'users.approve', 'users.manage',
    'devices.view', 'devices.control', 'devices.manage',
    'alerts.view', 'alerts.acknowledge',
    'deliveries.manage', 'reviews.create'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'customer'
  AND p.name IN ('deliveries.create', 'deliveries.view_own', 'reviews.create')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'motor_rider'
  AND p.name IN ('deliveries.assign', 'devices.view', 'alerts.view')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id UUID;
BEGIN
  SELECT id INTO default_role_id FROM public.roles WHERE name = 'customer' LIMIT 1;
  IF default_role_id IS NULL THEN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'viewer' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    default_role_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  distance_km DOUBLE PRECISION DEFAULT 5,
  calculated_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RWF',
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN (
    'awaiting_payment', 'payment_submitted', 'payment_verified',
    'rider_assigned', 'in_transit', 'delivered', 'cancelled'
  )),
  payment_method TEXT CHECK (payment_method IN ('momo', 'bank')),
  payment_proof_url TEXT,
  payment_submitted_at TIMESTAMPTZ,
  payment_verified_at TIMESTAMPTZ,
  payment_verified_by UUID REFERENCES public.profiles(id),
  unlock_token TEXT,
  token_expires_at TIMESTAMPTZ,
  token_sent_at TIMESTAMPTZ,
  token_used_at TIMESTAMPTZ,
  manager_notes TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_customer ON public.delivery_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_rider ON public.delivery_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON public.delivery_requests(status);

CREATE TABLE IF NOT EXISTS public.delivery_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL UNIQUE REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_reviews_rider ON public.delivery_reviews(rider_id);

ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS package_type TEXT;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS pickup_details JSONB;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS delivery_details JSONB;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS special_instructions TEXT;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS token_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.promo_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  poster_url TEXT,
  section TEXT NOT NULL DEFAULT 'roles',
  is_active BOOLEAN DEFAULT true,
  is_playing BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_videos_section ON public.promo_videos(section);
CREATE INDEX IF NOT EXISTS idx_promo_videos_playing ON public.promo_videos(is_playing, is_active);

ALTER TABLE public.promo_videos ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 3 — RWANDA LOCATIONS (rwanda-locations.sql)
-- =============================================================================

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

DROP POLICY IF EXISTS "Anyone can read rwanda locations" ON public.rwanda_locations;
CREATE POLICY "Anyone can read rwanda locations"
  ON public.rwanda_locations FOR SELECT
  USING (true);

-- Table only — no seed rows. Address dropdowns use client/src/data/rwandaAdmin.js.
-- Pickup/delivery GPS (pickup_latitude, delivery_latitude, etc.) come from map pins.

-- =============================================================================
-- PART 4 — DEFAULT ADMIN (seed-admin.sql)
-- =============================================================================

DO $$
DECLARE
  admin_user_id UUID := gen_random_uuid();
  admin_role_id UUID;
  existing_user_id UUID;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;

  SELECT id INTO existing_user_id FROM auth.users WHERE email = 'admin@system.com' LIMIT 1;

  IF existing_user_id IS NULL THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_user_id,
      'authenticated',
      'authenticated',
      'admin@system.com',
      crypt('admin123@', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"System Administrator"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      admin_user_id,
      jsonb_build_object('sub', admin_user_id::text, 'email', 'admin@system.com'),
      'email',
      admin_user_id::text,
      NOW(),
      NOW(),
      NOW()
    );

    existing_user_id := admin_user_id;
  END IF;

  UPDATE public.profiles
  SET
    full_name = 'System Administrator',
    role_id = admin_role_id,
    is_approved = TRUE,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = existing_user_id;

  INSERT INTO public.profiles (id, email, full_name, role_id, is_approved, approved_at)
  SELECT
    existing_user_id,
    'admin@system.com',
    'System Administrator',
    admin_role_id,
    TRUE,
    NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = existing_user_id);

  INSERT INTO public.device_access (user_id, device_id, can_view, can_control, granted_by)
  SELECT
    existing_user_id,
    d.id,
    TRUE,
    TRUE,
    existing_user_id
  FROM public.devices d
  ON CONFLICT (user_id, device_id) DO UPDATE
  SET can_view = TRUE, can_control = TRUE;
END $$;

-- =============================================================================
-- PART 5 — OPTIONAL FIXES (token-message + promo localhost URLs)
-- =============================================================================

COMMENT ON COLUMN public.delivery_requests.token_sent_at IS
  'When the unlock token message was sent to the customer dashboard/inbox';

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

-- =============================================================================
-- PART 6 — HISTORY, AUDIT & REPORTS
-- =============================================================================

INSERT INTO public.permissions (name, description) VALUES
  ('reports.view', 'View activity history and audit logs'),
  ('reports.generate', 'Generate and download PDF reports')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name IN ('admin', 'manager')
  AND p.name IN ('reports.view', 'reports.generate')
ON CONFLICT DO NOTHING;

-- Universal activity log (all important actions)
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

CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.activity_log(actor_id);

-- Delivery status timeline (every status transition)
CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_status_history_delivery
  ON public.delivery_status_history(delivery_id, created_at DESC);

-- Payment events (submit, verify, reject — full audit)
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

CREATE INDEX IF NOT EXISTS idx_payment_events_delivery ON public.payment_events(delivery_id, created_at DESC);

-- Live GPS trail from ESP32 (map capture coords stay on delivery_requests)
CREATE TABLE IF NOT EXISTS public.device_gps_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'mqtt' CHECK (source IN ('mqtt', 'manual', 'system')),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_gps_history_device ON public.device_gps_history(device_id, recorded_at DESC);

-- Generated PDF reports (manager & admin)
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

CREATE INDEX IF NOT EXISTS idx_generated_reports_created ON public.generated_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON public.generated_reports(report_type);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_gps_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view activity log" ON public.activity_log;
CREATE POLICY "Managers can view activity log" ON public.activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Managers can view delivery status history" ON public.delivery_status_history;
CREATE POLICY "Managers can view delivery status history" ON public.delivery_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
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
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
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
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
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
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND p.is_approved = TRUE AND r.name IN ('admin', 'manager')
    )
  );

-- Auto-update updated_at on delivery_requests
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

-- =============================================================================
-- DONE — Tables created:
--   roles, permissions, role_permissions, profiles,
--   devices, device_access, alerts,
--   delivery_requests, delivery_reviews, promo_videos,
--   rwanda_locations,
--   activity_log, delivery_status_history, payment_events,
--   device_gps_history, generated_reports
-- =============================================================================
