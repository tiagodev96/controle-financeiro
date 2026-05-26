import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DEFAULT_EMAIL = 'tiago@example.com';
const DEFAULT_PASSWORD = 'password-local';

export const SEED_TIAGO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const SEED_DEMO_HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
export const SEED_ACCOUNT_EUR_ID = '22222222-2222-4222-8222-222222222001';
export const SEED_ACCOUNT_BRL_ID = '22222222-2222-4222-8222-222222222002';
export const SEED_CATEGORY_MERCADO_ID = '33333333-3333-4333-8333-333333333001';
export const SEED_CATEGORY_RESTAURANTE_ID = '33333333-3333-4333-8333-333333333002';

type LoginOptions = {
  email?: string;
  password?: string;
};

export async function getAuthedClient(
  { email = DEFAULT_EMAIL, password = DEFAULT_PASSWORD }: LoginOptions = {}
): Promise<SupabaseClient<Database>> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidos.'
    );
  }
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`getAuthedClient: signIn failed para ${email}: ${error.message}`);
  }
  return client;
}

export const SEED_TIAGO_SESSION: Session = {
  userId: SEED_TIAGO_USER_ID,
  householdId: SEED_DEMO_HOUSEHOLD_ID,
  preferredDisplayCurrency: 'EUR',
};
