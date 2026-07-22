-- Anti-Tamper Smart Delivery Box Platform
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (name, description) VALUES
  ('admin', 'Full system access, user approval, device management'),
  ('operator', 'Can view and control assigned devices'),
  ('viewer', 'Read-only access to assigned devices');

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE public.permissions (
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
  ('alerts.acknowledge', 'Acknowledge and resolve alerts');

-- ============================================================
-- ROLE_PERMISSIONS (junction)
-- ============================================================
CREATE TABLE public.role_permissions (
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Admin gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p WHERE r.name = 'admin';

-- Operator permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'operator' AND p.name IN ('devices.view', 'devices.control', 'alerts.view', 'alerts.acknowledge');

-- Viewer permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'viewer' AND p.name IN ('devices.view', 'alerts.view');

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
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

-- Auto-create profile on signup (viewer role assigned via trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  default_role_id UUID;
BEGIN
  SELECT id INTO default_role_id FROM public.roles WHERE name = 'viewer' LIMIT 1;

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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE public.devices (
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

-- ============================================================
-- DEVICE_ACCESS (user-device permissions)
-- ============================================================
CREATE TABLE public.device_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT TRUE,
  can_control BOOLEAN DEFAULT FALSE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, device_id)
);

-- ============================================================
-- ALERTS / EVENTS
-- ============================================================
CREATE TABLE public.alerts (
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

CREATE INDEX idx_alerts_device ON public.alerts(device_id);
CREATE INDEX idx_alerts_created ON public.alerts(created_at DESC);
CREATE INDEX idx_devices_device_id ON public.devices(device_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own profile, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin' AND p.is_approved = TRUE
    )
  );

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin' AND p.is_approved = TRUE
    )
  );

-- Devices: approved users with access or admins
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

-- Alerts: same access as devices
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

-- Roles & permissions: readable by authenticated users
CREATE POLICY "Authenticated users can read roles" ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read permissions" ON public.permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated users can read role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);

-- Device access: users see own, admins see all
CREATE POLICY "Users can view own device access" ON public.device_access
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage device access" ON public.device_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.id = auth.uid() AND r.name = 'admin' AND p.is_approved = TRUE
    )
  );

-- ============================================================
-- HELPER: Check user permission
-- ============================================================
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

-- Seed demo device
INSERT INTO public.devices (device_id, name, description, latitude, longitude)
VALUES ('BOX-001', 'Delivery Box Alpha', 'Primary smart delivery box', 48.8566, 2.3522);
