import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';

export type UpcomingRow = {
  id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  direction: 'expense' | 'income';
  occurred_on: string;
  category_id: string | null;
  categories: { name: string } | null;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysFromIso(d: Date, days: number): string {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return isoDate(out);
}

/**
 * Lista transactions pending com occurred_on entre `now` (inclusive) e
 * `now + days` (inclusive). Pra widget "Próximos N dias" do dashboard.
 * Ordena por occurred_on asc — mais cedo primeiro.
 */
export async function listUpcomingPending(
  supabase: SupabaseClient<Database>,
  householdId: string,
  now: Date,
  days: number,
): Promise<UpcomingRow[]> {
  const start = isoDate(now);
  const endInclusive = daysFromIso(now, days);

  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, description, amount_cents, currency, direction, occurred_on, category_id, categories(name)',
    )
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .gte('occurred_on', start)
    .lte('occurred_on', endInclusive)
    .order('occurred_on', { ascending: true });

  if (error) throw new Error(`listUpcomingPending: ${error.message}`);
  return (data ?? []) as unknown as UpcomingRow[];
}
