import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type Direction = 'expense' | 'income';
export type Status = 'pending' | 'paid';
export type Currency = 'BRL' | 'EUR';

export type TxnListRow = {
  id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  direction: Direction;
  status: Status;
  occurred_on: string;
  paid_on: string | null;
  account_id: string;
  category_id: string | null;
  source_recurring_rule_id: string | null;
  source_installment_plan_id: string | null;
  installment_number: number | null;
  categories: { name: string } | null;
  installment_plans: { total_installments: number } | null;
};

export type ListFilters = {
  householdId: string;
  status?: Status;
  accountId?: string;
  monthIso?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 100;

function monthRange(monthIso: string): { start: string; end: string } {
  const [y, m] = monthIso.split('-').map(Number);
  if (!y || !m) throw new Error(`monthIso inválido: ${monthIso}`);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end: next };
}

/**
 * Lista transações do household. RLS-safe (cliente autenticado).
 * Retorna { transactions, total } — total reflete contagem antes do limit
 * pra exibir "mostrando N de M" quando estourar o teto.
 */
export async function listTransactionsForHousehold(
  supabase: SupabaseClient<Database>,
  filters: ListFilters,
): Promise<{ transactions: TxnListRow[]; total: number }> {
  const limit = filters.limit ?? DEFAULT_LIMIT;

  let query = supabase
    .from('transactions')
    .select(
      'id, description, amount_cents, currency, direction, status, occurred_on, paid_on, account_id, category_id, source_recurring_rule_id, source_installment_plan_id, installment_number, categories(name), installment_plans(total_installments)',
      { count: 'exact' },
    )
    .eq('household_id', filters.householdId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.accountId) query = query.eq('account_id', filters.accountId);

  if (filters.monthIso) {
    const { start, end } = monthRange(filters.monthIso);
    query = query.gte('occurred_on', start).lt('occurred_on', end);
  }

  query = query.order('occurred_on', { ascending: false }).limit(limit);

  const { data, count, error } = await query;
  if (error) throw new Error(`listTransactionsForHousehold: ${error.message}`);

  const rows = (data ?? []) as unknown as TxnListRow[];
  // Reordena pela "data efetiva": paid_on quando pago, senão occurred_on.
  // Dentro do mesmo dia, paid vem antes de pending; final tie por id (estável).
  rows.sort((a, b) => {
    const aKey = a.paid_on ?? a.occurred_on;
    const bKey = b.paid_on ?? b.occurred_on;
    if (aKey !== bKey) return bKey > aKey ? 1 : -1;
    if (a.status !== b.status) return a.status === 'paid' ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });

  return {
    transactions: rows,
    total: count ?? 0,
  };
}
