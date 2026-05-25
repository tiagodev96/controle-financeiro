import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type AccountFull = {
  id: string;
  name: string;
  currency: 'BRL' | 'EUR';
  balance_cents: number;
  is_archived: boolean;
  sort_order: number;
};

/**
 * Lista todas contas (ativas + arquivadas) do household. Pra UI de CRUD em
 * /contas. Ordem por sort_order asc, depois name.
 */
export async function listAllAccountsForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<AccountFull[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, currency, balance_cents, is_archived, sort_order')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`listAllAccountsForHousehold: ${error.message}`);
  return (data ?? []) as AccountFull[];
}
