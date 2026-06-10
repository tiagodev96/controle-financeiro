import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';

export type Envelope = {
  id: string;
  name: string;
  currency: Currency;
  target_cents: number | null;
  current_cents: number;
  monthly_contribution_cents: number | null;
  sort_order: number;
  is_reserve: boolean;
};

export async function listAllEnvelopesForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<Envelope[]> {
  const { data } = await supabase
    .from('envelopes')
    .select(
      'id, name, currency, target_cents, current_cents, monthly_contribution_cents, sort_order, is_reserve',
    )
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []) as Envelope[];
}

/**
 * Agrega current_cents por currency. Usado pra calcular "saldo livre"
 * (balance da currency − soma alocada).
 */
export async function sumEnvelopesByCurrency(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<Record<Currency, number>> {
  const { data } = await supabase
    .from('envelopes')
    .select('currency, current_cents')
    .eq('household_id', householdId);

  const totals: Record<Currency, number> = { EUR: 0, BRL: 0 };
  for (const row of data ?? []) {
    const cur = row.currency as Currency;
    totals[cur] += row.current_cents;
  }
  return totals;
}
