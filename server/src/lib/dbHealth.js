const CORE_TABLES = [
  'roles',
  'profiles',
  'devices',
  'delivery_requests',
  'promo_videos',
];

function projectRefFromUrl(url) {
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

async function countTable(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (error) {
    return { ok: false, rows: null, error: error.message };
  }
  return { ok: true, rows: count ?? 0 };
}

/**
 * Query real Postgres tables through the Supabase client.
 * This is stronger than an Auth HTTP ping — it proves the service role can read data.
 */
export async function checkDatabase(supabase, options = {}) {
  const timeoutMs = options.timeoutMs ?? 8000;
  const started = Date.now();
  const supabaseUrl = (process.env.SUPABASE_URL || '')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');

  const configured = {
    url: Boolean(supabaseUrl),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    anonKey: Boolean(process.env.SUPABASE_ANON_KEY?.trim()),
  };

  if (!configured.url || !configured.serviceRole) {
    return {
      connected: false,
      status: 'down',
      latencyMs: Date.now() - started,
      project: projectRefFromUrl(supabaseUrl),
      configured,
      error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing',
      tables: {},
    };
  }

  try {
    const result = await Promise.race([
      (async () => {
        const entries = await Promise.all(
          CORE_TABLES.map(async (table) => [table, await countTable(supabase, table)]),
        );
        return Object.fromEntries(entries);
      })(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Database check timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);

    const tables = result;
    const failed = Object.entries(tables).filter(([, info]) => !info.ok);
    const connected = failed.length === 0;
    const firstError = failed[0]?.[1]?.error || null;

    return {
      connected,
      status: connected ? 'ok' : 'degraded',
      latencyMs: Date.now() - started,
      project: projectRefFromUrl(supabaseUrl),
      configured,
      error: firstError,
      tables,
    };
  } catch (err) {
    return {
      connected: false,
      status: 'down',
      latencyMs: Date.now() - started,
      project: projectRefFromUrl(supabaseUrl),
      configured,
      error: err.message || 'Unreachable',
      tables: {},
    };
  }
}

export function formatDatabaseLog(db) {
  if (!db.connected) {
    return `Database: ${db.status.toUpperCase()} — ${db.error || 'not connected'} (${db.latencyMs}ms)`;
  }
  const summary = Object.entries(db.tables)
    .map(([name, info]) => `${info.rows} ${name}`)
    .join(', ');
  return `Database: connected (${db.latencyMs}ms) — ${summary}`;
}
