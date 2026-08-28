/**
 * Render production build: compile the React app so Express can serve it
 * at the same URL as the API (https://anti-tamper.onrender.com).
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = join(root, 'client');

process.env.VITE_API_URL = '';
process.env.VITE_SOCKET_URL = '';

if (!process.env.VITE_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (!process.env.VITE_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
  process.env.VITE_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Skipping website build — set SUPABASE_ANON_KEY (or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) on Render.',
  );
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'build'], {
  cwd: clientDir,
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
