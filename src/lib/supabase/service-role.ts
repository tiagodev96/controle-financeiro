import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let cached: SupabaseClient<Database> | null = null;

/**
 * Client com service role key — bypassa RLS. Usar APENAS em código
 * server-side que precisa escrever em tabelas com policy restrita (ex:
 * fx_rates_cache). Nunca importar de client component ou expor ao browser.
 */
export function getServiceRoleSupabase(): SupabaseClient<Database> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — não foi possível criar service client.');
  }
  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
