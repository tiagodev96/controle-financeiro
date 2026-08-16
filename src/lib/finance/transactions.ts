import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { monthRangeFromIso } from '@/lib/dates';

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
  credit_card_id: string | null;
  purchased_on: string | null;
  categories: { name: string } | null;
  installment_plans: { total_installments: number } | null;
  credit_cards: { name: string } | null;
};

export type ListFilters = {
  householdId: string;
  status?: Status;
  accountId?: string;
  /** Filtro por categoria. `'none'` = só sem categoria (orfãs). */
  categoryId?: string | 'none';
  /** Só compras de um cartão específico. */
  creditCardId?: string;
  monthIso?: string;
  /** Range customizado (YYYY-MM-DD). Tem precedência sobre monthIso. */
  startDate?: string;
  endDate?: string;
  /** Busca case-insensitive na description (ILIKE %query%). */
  query?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 100;

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
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
      'id, description, amount_cents, currency, direction, status, occurred_on, paid_on, account_id, category_id, source_recurring_rule_id, source_installment_plan_id, installment_number, credit_card_id, purchased_on, categories(name), installment_plans(total_installments), credit_cards(name)',
      { count: 'exact' },
    )
    .eq('household_id', filters.householdId);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.accountId) query = query.eq('account_id', filters.accountId);
  if (filters.creditCardId) query = query.eq('credit_card_id', filters.creditCardId);

  if (filters.categoryId === 'none') {
    query = query.is('category_id', null);
  } else if (filters.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }

  // Date range tem precedência sobre monthIso.
  if (filters.startDate || filters.endDate) {
    if (filters.startDate) query = query.gte('occurred_on', filters.startDate);
    if (filters.endDate) query = query.lte('occurred_on', filters.endDate);
  } else if (filters.monthIso) {
    const { start, end } = monthRangeFromIso(filters.monthIso);
    query = query.gte('occurred_on', start).lt('occurred_on', end);
  }

  if (filters.query && filters.query.trim().length > 0) {
    // Escapa wildcards do ILIKE pra evitar busca acidental por padrão.
    const escaped = filters.query.trim().replace(/[%_\\]/g, (m) => `\\${m}`);
    query = query.ilike('description', `%${escaped}%`);
  }

  query = query.order('occurred_on', { ascending: false }).limit(limit);

  const { data, count, error } = await query;
  if (error) throw new Error(`listTransactionsForHousehold: ${error.message}`);

  // Relações joined podem inferir como array — normaliza em runtime.
  const rows: TxnListRow[] = (data ?? []).map((t) => ({
    ...t,
    currency: t.currency as Currency,
    direction: t.direction as Direction,
    status: t.status as Status,
    categories: one(t.categories),
    installment_plans: one(t.installment_plans),
    credit_cards: one(t.credit_cards),
  }));
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
