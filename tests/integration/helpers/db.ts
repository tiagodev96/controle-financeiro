import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient<Database> | null = null;

// Bypassa RLS via service role. Usar APENAS em helpers de teste — testes de
// lógica devem ir por cliente autenticado pra exercitar as policies.
export function getAdminClient(): SupabaseClient<Database> {
  if (adminClient) return adminClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos no ambiente.'
    );
  }
  adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export async function truncateHouseholdTransactions(householdId: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('transactions')
    .delete()
    .eq('household_id', householdId);
  if (error) {
    throw new Error(`truncateHouseholdTransactions failed: ${error.message}`);
  }
}

export async function createIsolatedHousehold(): Promise<{
  householdId: string;
  categoryId: string;
}> {
  const admin = getAdminClient();
  const { data: household, error: hhError } = await admin
    .from('households')
    .insert({ name: 'Isolated Test Household', base_currency: 'EUR' })
    .select('id')
    .single();
  if (hhError || !household) {
    throw new Error(`createIsolatedHousehold (household): ${hhError?.message}`);
  }
  const { data: category, error: catError } = await admin
    .from('categories')
    .insert({
      household_id: household.id,
      name: 'Categoria Isolada',
      kind: 'expense',
      sort_order: 1,
    })
    .select('id')
    .single();
  if (catError || !category) {
    throw new Error(`createIsolatedHousehold (category): ${catError?.message}`);
  }
  return { householdId: household.id, categoryId: category.id };
}

export async function deleteIsolatedHousehold(householdId: string): Promise<void> {
  const admin = getAdminClient();
  // ON DELETE CASCADE em households arrasta categories e transactions.
  const { error } = await admin.from('households').delete().eq('id', householdId);
  if (error) {
    throw new Error(`deleteIsolatedHousehold failed: ${error.message}`);
  }
}
