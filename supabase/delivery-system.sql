-- Smart Box Delivery System — run AFTER schema.sql in Supabase SQL Editor

-- ============================================================
-- NEW ROLES
-- ============================================================
INSERT INTO public.roles (name, description) VALUES
  ('customer', 'Requests deliveries, pays, unlocks box with token, leaves reviews'),
  ('manager', 'Approves accounts, verifies payments, assigns riders, controls boxes'),
  ('motor_rider', 'Receives assignments and delivers Smart Boxes')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- NEW PERMISSIONS
-- ============================================================
INSERT INTO public.permissions (name, description) VALUES
  ('deliveries.create', 'Create delivery requests'),
  ('deliveries.view_own', 'View own delivery requests'),
  ('deliveries.manage', 'Manage all deliveries, verify payments, assign riders'),
  ('deliveries.assign', 'View and update assigned deliveries as rider'),
  ('reviews.create', 'Submit delivery reviews and ratings')
ON CONFLICT (name) DO NOTHING;

-- Manager permissions (admin keeps all via existing seed)
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

-- Default signup role → customer
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

-- ============================================================
-- DELIVERY REQUESTS
-- ============================================================
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
  token_used_at TIMESTAMPTZ,
  manager_notes TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_requests_customer ON public.delivery_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_rider ON public.delivery_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON public.delivery_requests(status);

-- ============================================================
-- REVIEWS
-- ============================================================
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

-- RLS (service role bypasses; policies for future direct client access)
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_reviews ENABLE ROW LEVEL SECURITY;

-- Extended delivery fields (Rwanda address, package type, map coords)
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS package_type TEXT;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT false;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS pickup_details JSONB;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS delivery_details JSONB;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS pickup_latitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS pickup_longitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- ============================================================
-- PROMO / ADVERTISEMENT VIDEOS (roles section background)
-- ============================================================
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