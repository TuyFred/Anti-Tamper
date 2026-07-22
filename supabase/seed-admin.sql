-- Seed default admin user
-- Email:    admin@system.com
-- Password: admin123@
--
-- Run AFTER schema.sql AND delivery-system.sql in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

  -- Promote to admin (profile is auto-created by trigger on auth.users insert)
  UPDATE public.profiles
  SET
    full_name = 'System Administrator',
    role_id = admin_role_id,
    is_approved = TRUE,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = existing_user_id;

  -- If profile missing (trigger was not active), create it manually
  INSERT INTO public.profiles (id, email, full_name, role_id, is_approved, approved_at)
  SELECT
    existing_user_id,
    'admin@system.com',
    'System Administrator',
    admin_role_id,
    TRUE,
    NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = existing_user_id);

  -- Grant full access to all devices
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
