import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, type RateMap } from '@/lib/fx';
import {
  monthlyEssential,
  monthlyRecurringExpenseCents,
  type MonthlyEssential,
  type RecurringExpenseRule,
} from './reserva';
import { loadReserveEnvelopes } from './reserva-envelopes';

function monthStartIso(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

function dayIso(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    .toISOString()
    .slice(0, 10);
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

/**
 * Custo mensal essencial em `targetCurrency`: recorrentes de despesa ativas
 * (normalizadas a mês) + mediana dos 3 meses completos anteriores do gasto
 * variável em categorias essenciais (excluindo o que veio de recorrente,
 * parcela ou dívida, pra não contar duplo). Com <3 meses completos de
 * histórico, a parte variável é descartada e marcada como calibrando.
 */
export async function loadMonthlyEssential(params: {
  supabase: SupabaseClient<Database>;
  householdId: string;
  targetCurrency: Currency;
  fxRateMap: RateMap | null;
  now: Date;
}): Promise<MonthlyEssential> {
  const { supabase, householdId, targetCurrency, fxRateMap, now } = params;

  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStarts = [
    monthStartIso(year, month - 3),
    monthStartIso(year, month - 2),
    monthStartIso(year, month - 1),
  ] as const;
  const windowStartIso = monthStarts[0];
  const windowEndIso = monthStartIso(year, month);
  const todayIso = dayIso(now);

  const { data: ruleRows } = await supabase
    .from('recurring_rules')
    .select('amount_cents, currency, frequency, active_from, active_until')
    .eq('household_id', householdId)
    .eq('direction', 'expense')
    .eq('is_paused', false);

  const recurring: RecurringExpenseRule[] = [];
  for (const rule of ruleRows ?? []) {
    if (rule.active_from && rule.active_from > todayIso) continue;
    if (rule.active_until && rule.active_until < todayIso) continue;
    const converted = convertToTarget(
      rule.amount_cents,
      rule.currency as Currency,
      targetCurrency,
      fxRateMap,
    );
    if (converted === null) continue;
    recurring.push({ amountCents: converted, frequency: rule.frequency as 'monthly' | 'yearly' });
  }
  const recurringMonthlyCents = monthlyRecurringExpenseCents(recurring);

  const variableMonthlyTotals = [0, 0, 0];
  const { data: essentialCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('is_essential', true);
  const essentialCategoryIds = (essentialCategories ?? []).map((c) => c.id);

  if (essentialCategoryIds.length > 0) {
    const { data: txnRows } = await supabase
      .from('transactions')
      .select('amount_cents, currency, occurred_on')
      .eq('household_id', householdId)
      .eq('direction', 'expense')
      .in('category_id', essentialCategoryIds)
      .is('source_recurring_rule_id', null)
      .is('source_installment_plan_id', null)
      .is('source_debt_id', null)
      .gte('occurred_on', windowStartIso)
      .lt('occurred_on', windowEndIso);

    for (const txn of txnRows ?? []) {
      const converted = convertToTarget(
        txn.amount_cents,
        txn.currency as Currency,
        targetCurrency,
        fxRateMap,
      );
      if (converted === null) continue;
      let index = 2;
      if (txn.occurred_on < monthStarts[1]) index = 0;
      else if (txn.occurred_on < monthStarts[2]) index = 1;
      variableMonthlyTotals[index]! += converted;
    }
  }

  const { data: earliest } = await supabase
    .from('transactions')
    .select('occurred_on')
    .eq('household_id', householdId)
    .order('occurred_on', { ascending: true })
    .limit(1)
    .maybeSingle();
  const hasEnoughHistory = !!earliest && earliest.occurred_on <= windowStartIso;

  return monthlyEssential({
    recurringMonthlyCents,
    variableMonthlyTotals,
    hasEnoughHistory,
  });
}

/** Saldo das subcontas de reserva consolidado em `targetCurrency` (0 se não há). */
export async function loadReservaAllocatedCents(params: {
  supabase: SupabaseClient<Database>;
  householdId: string;
  targetCurrency: Currency;
  fxRateMap: RateMap | null;
}): Promise<number> {
  const reserves = await loadReserveEnvelopes(params.supabase, params.householdId);
  let total = 0;
  for (const reserve of reserves) {
    const converted = convertToTarget(
      reserve.currentCents,
      reserve.currency,
      params.targetCurrency,
      params.fxRateMap,
    );
    total += converted ?? 0;
  }
  return total;
}
