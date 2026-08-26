/** Map Supabase auth errors to clear messages for users */
export function formatAuthError(error) {
  const msg = (error?.message || String(error)).toLowerCase();
  const code = error?.code;

  if (code === 'SUPABASE_UNREACHABLE' || msg.includes('supabase project not found')) {
    return error.message || 'Cannot connect to Supabase. Update SUPABASE_URL in server/.env and VITE_SUPABASE_URL in client/.env with a valid project from supabase.com, then restart both apps.';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('authretryablefetcherror')) {
    return 'Cannot reach Supabase. Your project URL may be wrong or deleted. Open supabase.com → create or restore a project → copy Project URL + anon key into client/.env and server/.env, then restart.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Wrong email or password. Check your details or ask a manager to reset your password.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Ask a manager to reset your password, or register again.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'This email is already registered. Try signing in instead.';
  }
  if (msg.includes('password') && msg.includes('6')) {
    return 'Password must be at least 6 characters.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  return error?.message || 'Authentication failed. Please try again.';
}
