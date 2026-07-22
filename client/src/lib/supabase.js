import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim?.() || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim?.() || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. In Vercel → Project → Settings → Environment Variables, '
    + 'add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (from Supabase Dashboard → Project Settings → API), '
    + 'then redeploy the project.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
