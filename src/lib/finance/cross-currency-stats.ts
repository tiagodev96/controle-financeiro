import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, type RateMap } from '@/lib/fx';

export type CrossCurrencyTopCategory = {
  id: string;
  name: string;
  totalCents: number;
};

export type CrossCurrencyMonthStats = {
  paidIncomeCents: number;
  paidIncomeCount: number;
  pendingIncomeCents: number;
  paidExpenseCents: number;
  paidExpenseCount: number;
  pendingExpenseCents: number;
  pendingExpenseCount: number;
  overdueCents: number;
  overdueCount: number;
  /**
   * `accountsTotalInTargetCents + pendingIncome - pendingExpense`, em
   * `targetCurrency`. NÃO subtrai overdue (segue convenção do
   * calculateMonthStats original).
   */
  saldoPrevistoFimDoMesCents: number;
  topCategories: CrossCurrencyTopCategory[];
  /** True se algum txn em currency diferente do target ficou fora por falta de FX. */
  fxIncomplete: boolean;
};

function monthRange(targetDate: Date): { start: string; end: string } {
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

function todayIsoOf(targetDate: Date): string {
  return targetDate.toISOString().slice(0, 10);
}

function convertToTarget(
  cents: number,
  from: Currency,
  target: Currency,
  fxRateMap: RateMap | null,
): number | null {
  if (from === target) return cents;
  if (!fxRateMap) return null;
  const rate = target === 'EUR' ? fxRateMap.BRL_EUR : fxRateMap.EUR_BRL;
  return convertCents(cents, rate);
}

type Args = {
  supabase: SupabaseClient<Database>;
  householdId: string;
  targetCurrency: Currency;
  fxRateMap: RateMap | null;
  /** Soma das contas em targetCurrency (caller já fez a conversão). */
  accountsTotalInTargetCents: number;
  targetDate: Date;
  /**
   * Data de referência pro corte de "em atraso" (pending com occurred_on <
   * nowDate). Default: targetDate — preserva a semântica do mês corrente/passado.
   * Pra projeção de mês futuro, o caller passa a data real de hoje: nada do mês
   * alvo está atrasado ainda, então tudo conta como pending (a vencer).
   */
  nowDate?: Date;
  topCategoriesLimit?: number;
};

/**
 * Stats do mês agregados em `targetCurrency`. Faz UMA query em transactions
 * sem filtro de currency; loop converte cada amount via fxRateMap.
 *
 * Cents em currency diferente do target ficam fora se fxRateMap=null e
 * flagga `fxIncomplete=true`. Caller mostra label sutil.
 */
export async function calculateCrossCurrencyMonthStats({
  supabase,
  householdId,
  targetCurrency,
  fxRateMap,
  accountsTotalInTargetCents,
  targetDate,
  nowDate,
  topCategoriesLimit = 3,
}: Args): Promise<CrossCurrencyMonthStats> {
  const { start, end } = monthRange(targetDate);
  const today = todayIsoOf(nowDate ?? targetDate);

  // Mesma query que o calculateMonthStats faz (sem filtro de currency).
  // Precisamos de todos os txns do household pra capturar overdue (pending
  // expense com occurred_on de meses anteriores). +categoria pra top cats.
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'amount_cents, currency, direction, status, occurred_on, paid_on, category_id, categories(name)',
    )
    .eq('household_id', householdId);

  if (error) throw new Error(`calculateCrossCurrencyMonthStats: ${error.message}`);

  type Row = {
    amount_cents: number;
    currency: Currency;
    direction: 'expense' | 'income';
    status: 'pending' | 'paid';
    occurred_on: string;
    paid_on: string | null;
    category_id: string | null;
    categories: { name: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  let paidIncomeCents = 0;
  let paidIncomeCount = 0;
  let pendingIncomeCents = 0;
  let paidExpenseCents = 0;
  let paidExpenseCount = 0;
  let pendingExpenseCents = 0;
  let pendingExpenseCount = 0;
  let overdueCents = 0;
  let overdueCount = 0;
  let fxIncomplete = false;

  const byCategory = new Map<string, { name: string; totalCents: number }>();

  for (const t of rows) {
    const converted = convertToTarget(t.amount_cents, t.currency, targetCurrency, fxRateMap);
    if (converted === null) {
      fxIncomplete = true;
      continue;
    }

    const inMonth = t.occurred_on >= start && t.occurred_on < end;
    const isExpense = t.direction === 'expense';
    const isPaidInMonth =
      t.status === 'paid' && t.paid_on != null && t.paid_on >= start && t.paid_on < end;

    if (isExpense && isPaidInMonth) {
      paidExpenseCents += converted;
      paidExpenseCount += 1;
    }
    if (!isExpense && isPaidInMonth) {
      paidIncomeCents += converted;
      paidIncomeCount += 1;
    }

    if (t.status === 'pending' && isExpense) {
      if (t.occurred_on < today) {
        overdueCents += converted;
        overdueCount += 1;
      } else if (inMonth) {
        pendingExpenseCents += converted;
        pendingExpenseCount += 1;
      }
    }

    if (t.status === 'pending' && inMonth && !isExpense) {
      pendingIncomeCents += converted;
    }

    // Top categorias: paid + pending no mês (segue padrão do
    // topCategoriesThisMonth original que usa occurred_on no mês).
    if (isExpense && inMonth && t.category_id && t.categories) {
      const cur = byCategory.get(t.category_id) ?? {
        name: t.categories.name,
        totalCents: 0,
      };
      cur.totalCents += converted;
      byCategory.set(t.category_id, cur);
    }
  }

  const topCategories = Array.from(byCategory.entries())
    .map(([id, { name, totalCents }]) => ({ id, name, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, topCategoriesLimit);

  const saldoPrevistoFimDoMesCents =
    accountsTotalInTargetCents + pendingIncomeCents - pendingExpenseCents;

  return {
    paidIncomeCents,
    paidIncomeCount,
    pendingIncomeCents,
    paidExpenseCents,
    paidExpenseCount,
    pendingExpenseCents,
    pendingExpenseCount,
    overdueCents,
    overdueCount,
    saldoPrevistoFimDoMesCents,
    topCategories,
    fxIncomplete,
  };
}
