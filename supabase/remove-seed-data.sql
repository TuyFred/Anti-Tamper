-- Remove demo / seed location data from an existing database.
-- Run in Supabase SQL Editor if you already applied older scripts with BOX-001 or rwanda_locations seeds.
-- Safe to run multiple times.

-- Demo device with fixed coordinates (not live GPS)
DELETE FROM public.device_access
WHERE device_id IN (SELECT id FROM public.devices WHERE device_id = 'BOX-001');

DELETE FROM public.devices
WHERE device_id = 'BOX-001';

-- Pre-seeded Rwanda reference rows (address dropdowns use client/src/data/rwandaAdmin.js)
DELETE FROM public.rwanda_locations;

-- Admin user (seed-admin.sql) is kept — you still need a login account.
-- Roles, permissions, and schema are unchanged.
