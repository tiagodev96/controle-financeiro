import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type Currency = 'BRL' | 'EUR';

export type MonthBucket = {
  count: number;
  totalCents: number;
};

export type MonthStats = {
  paid: MonthBucket;
  pending: MonthBucket;
  overdue: MonthBucket;
  incomePaid: MonthBucket;
  sobraPrevistaCents: number;
};

export type CategorySpent = {
  id: string;
  name: string;
  totalCents: number;
  pctOfMax: number;
};

function monthRange(now: Date): { start: string; end: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1).toISOString().slice(0, 10);
  const end = new Date(y, m + 1, 1).toISOString().slice(0, 10);
  return { start, end };
}

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Stats agregadas do mês corrente pra uma moeda:
 *   - pago: o que já foi liquidado este mês (saída)
 *   - pendente: vencendo de hoje até fim do mês
 *   - em atraso: pending com occurred_on < hoje (qualquer mês anterior)
 *   - sobra prevista: saldo atual + entradas pendentes mês - despesas pendentes mês
 *
 * Volume esperado < 200 transações/mês — agregação client-side é OK.
 */
export async function calculateMonthStats(
  supabase: SupabaseClient<Database>,
  householdId: string,
  currency: Currency,
  balanceCents: number,
  now: Date = new Date(),
): Promise<MonthStats> {
  const { start, end } = monthRange(now);
  const today = todayIso(now);

  const { data } = await supabase
    .from('transactions')
    .select('amount_cents, direction, status, occurred_on, paid_on')
    .eq('household_id', householdId)
    .eq('currency', currency);

  const rows = data ?? [];

  let paidCount = 0;
  let paidTotal = 0;
  let pendingCount = 0;
  let pendingTotal = 0;
  let overdueCount = 0;
  let overdueTotal = 0;
  let incomePaidCount = 0;
  let incomePaidTotal = 0;
  let pendingIncomeMonth = 0;
  let pendingExpenseMonth = 0;

  for (const t of rows) {
    const inMonth = t.occurred_on >= start && t.occurred_on < end;
    const isExpense = t.direction === 'expense';
    const isPaidInMonth =
      t.status === 'paid' && t.paid_on && t.paid_on >= start && t.paid_on < end;

    if (isExpense && isPaidInMonth) {
      paidCount += 1;
      paidTotal += t.amount_cents;
    }
    if (!isExpense && isPaidInMonth) {
      incomePaidCount += 1;
      incomePaidTotal += t.amount_cents;
    }

    if (t.status === 'pending' && isExpense) {
      if (t.occurred_on < today) {
        overdueCount += 1;
        overdueTotal += t.amount_cents;
      } else if (inMonth) {
        pendingCount += 1;
        pendingTotal += t.amount_cents;
      }
    }

    if (t.status === 'pending' && inMonth) {
      if (t.direction === 'income') pendingIncomeMonth += t.amount_cents;
      else pendingExpenseMonth += t.amount_cents;
    }
  }

  const sobraPrevistaCents = balanceCents + pendingIncomeMonth - pendingExpenseMonth;

  return {
    paid: { count: paidCount, totalCents: paidTotal },
    pending: { count: pendingCount, totalCents: pendingTotal },
    overdue: { count: overdueCount, totalCents: overdueTotal },
    incomePaid: { count: incomePaidCount, totalCents: incomePaidTotal },
    sobraPrevistaCents,
  };
}

/**
 * Top categorias de despesa do mês corrente, com pct relativo ao maior.
 */
export async function topCategoriesThisMonth(
  supabase: SupabaseClient<Database>,
  householdId: string,
  currency: Currency,
  limit = 5,
  now: Date = new Date(),
): Promise<CategorySpent[]> {
  const { start, end } = monthRange(now);

  const { data } = await supabase
    .from('transactions')
    .select('amount_cents, categories(id, name)')
    .eq('household_id', householdId)
    .eq('currency', currency)
    .eq('direction', 'expense')
    .gte('occurred_on', start)
    .lt('occurred_on', end);

  const rows = (data ?? []) as unknown as {
    amount_cents: number;
    categories: { id: string; name: string } | null;
  }[];

  const byCat = new Map<string, { name: string; totalCents: number }>();
  for (const t of rows) {
    if (!t.categories) continue;
    const cur = byCat.get(t.categories.id) ?? { name: t.categories.name, totalCents: 0 };
    cur.totalCents += t.amount_cents;
    byCat.set(t.categories.id, cur);
  }

  const sorted = Array.from(byCat.entries())
    .map(([id, { name, totalCents }]) => ({ id, name, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, limit);

  const max = sorted[0]?.totalCents ?? 1;
  return sorted.map((c) => ({ ...c, pctOfMax: c.totalCents / max }));
}
