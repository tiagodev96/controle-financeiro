import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';

export type DebtRow = {
  id: string;
  title: string;
  original_amount_cents: number;
  remaining_amount_cents: number;
  currency: Currency;
  priority: 1 | 2 | 3;
  status: 'open' | 'closed';
  notes: string | null;
  closed_at: string | null;
};

export type DebtListResult = {
  open: DebtRow[];
  closed: DebtRow[];
};

/**
 * Lista todas dívidas do household, ordenadas:
 * - abertas: priority asc, depois remaining desc
 * - fechadas: closed_at desc
 */
export async function listDebtsForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<DebtListResult> {
  const { data, error } = await supabase
    .from('debts')
    .select(
      'id, title, original_amount_cents, remaining_amount_cents, currency, priority, status, notes, closed_at',
    )
    .eq('household_id', householdId);

  if (error) throw new Error(`listDebtsForHousehold: ${error.message}`);

  const all = (data ?? []) as DebtRow[];

  const open = all
    .filter((d) => d.status === 'open')
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.remaining_amount_cents - a.remaining_amount_cents;
    });

  const closed = all
    .filter((d) => d.status === 'closed')
    .sort((a, b) => (b.closed_at ?? '').localeCompare(a.closed_at ?? ''));

  return { open, closed };
}
