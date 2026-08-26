-- Optional contact field on user profiles (run once in Supabase SQL editor)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.profiles.phone IS 'User phone number for delivery contact';
