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

function monthRange(now: Date): { start: string; end: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

/**
 * Soma valor pago por dívida no mês corrente (status=paid, paid_on no
 * intervalo). Retorna map debtId → cents. Apenas debt_ids que tiveram
 * pagamento aparecem.
 */
export async function sumDebtPaymentsThisMonth(
  supabase: SupabaseClient<Database>,
  householdId: string,
  now: Date,
): Promise<Record<string, number>> {
  const { start, end } = monthRange(now);
  const { data, error } = await supabase
    .from('transactions')
    .select('source_debt_id, amount_cents')
    .eq('household_id', householdId)
    .eq('status', 'paid')
    .not('source_debt_id', 'is', null)
    .gte('paid_on', start)
    .lt('paid_on', end);

  if (error) throw new Error(`sumDebtPaymentsThisMonth: ${error.message}`);

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.source_debt_id) continue;
    map[row.source_debt_id] = (map[row.source_debt_id] ?? 0) + row.amount_cents;
  }
  return map;
}
