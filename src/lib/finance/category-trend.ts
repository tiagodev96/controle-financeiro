import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, type RateMap } from '@/lib/fx';
import { addMonths, monthIso, monthRangeFromIso } from '@/lib/dates';

export type CategoryTrendPoint = { monthIso: string; totalCents: number };

export type CategoryTrendSeries = {
  id: string;
  name: string;
  /** Soma do período inteiro, na currency alvo. */
  totalCents: number;
  /** Um ponto por mês da janela, zerado quando sem gasto. */
  points: CategoryTrendPoint[];
};

export type CategoryTrendResult = {
  /** YYYY-MM asc, do mais antigo pro corrente. */
  months: string[];
  /** Top categorias por total no período, desc. */
  series: CategoryTrendSeries[];
  /** Soma das categorias fora do top. */
  othersTotalCents: number;
  /** True quando algum gasto ficou fora por falta de fx. */
  fxIncomplete: boolean;
};

export type TrendOptions = {
  currency: Currency;
  fxRateMap: RateMap | null;
  now: Date;
  monthsCount?: number;
  topCount?: number;
};

const NO_CATEGORY_LABEL = 'Sem categoria';

function monthWindow(now: Date, monthsCount: number): string[] {
  const current = monthIso(now);
  const months: string[] = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    months.push(addMonths(current, -i));
  }
  return months;
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
 * Gasto por categoria por mês (occurred_on, qualquer status — mesma
 * semântica das top categorias do mês). Convertido pra `currency`;
 * gasto em moeda sem fx fica fora e flagga fxIncomplete.
 */
export async function loadCategoryTrend(
  supabase: SupabaseClient<Database>,
  householdId: string,
  options: TrendOptions,
): Promise<CategoryTrendResult> {
  const { currency, fxRateMap, now } = options;
  const monthsCount = options.monthsCount ?? 6;
  const topCount = options.topCount ?? 5;

  const months = monthWindow(now, monthsCount);
  const { start } = monthRangeFromIso(months[0]!);
  const { end } = monthRangeFromIso(months[months.length - 1]!);

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount_cents, currency, occurred_on, categories(name)')
    .eq('household_id', householdId)
    .eq('direction', 'expense')
    .gte('occurred_on', start)
    .lt('occurred_on', end);

  if (error) throw new Error(`loadCategoryTrend: ${error.message}`);

  type Bucket = {
    id: string;
    name: string;
    totalCents: number;
    byMonth: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>();
  let fxIncomplete = false;

  for (const t of data ?? []) {
    const converted = convertToTarget(t.amount_cents, t.currency as Currency, currency, fxRateMap);
    if (converted === null) {
      fxIncomplete = true;
      continue;
    }
    const id = t.category_id ?? 'none';
    const joined = Array.isArray(t.categories) ? t.categories[0] : t.categories;
    const name = joined?.name ?? NO_CATEGORY_LABEL;
    const bucket = buckets.get(id) ?? { id, name, totalCents: 0, byMonth: new Map() };
    const ym = t.occurred_on.slice(0, 7);
    bucket.totalCents += converted;
    bucket.byMonth.set(ym, (bucket.byMonth.get(ym) ?? 0) + converted);
    buckets.set(id, bucket);
  }

  const ranked = Array.from(buckets.values()).sort((a, b) => b.totalCents - a.totalCents);
  const top = ranked.slice(0, topCount);
  const othersTotalCents = ranked.slice(topCount).reduce((sum, b) => sum + b.totalCents, 0);

  return {
    months,
    series: top.map((b) => ({
      id: b.id,
      name: b.name,
      totalCents: b.totalCents,
      points: months.map((ym) => ({ monthIso: ym, totalCents: b.byMonth.get(ym) ?? 0 })),
    })),
    othersTotalCents,
    fxIncomplete,
  };
}

export type MonthlyFlowPoint = {
  monthIso: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type MonthlyFlowResult = {
  months: MonthlyFlowPoint[];
  fxIncomplete: boolean;
};

/**
 * Fluxo realizado por mês: entradas e despesas PAGAS (paid_on no mês),
 * net = entradas − despesas. Pendentes ficam de fora — sobra histórica é
 * fluxo que aconteceu, não previsão.
 */
export async function loadMonthlyFlow(
  supabase: SupabaseClient<Database>,
  householdId: string,
  options: Omit<TrendOptions, 'topCount'>,
): Promise<MonthlyFlowResult> {
  const { currency, fxRateMap, now } = options;
  const monthsCount = options.monthsCount ?? 6;

  const months = monthWindow(now, monthsCount);
  const { start } = monthRangeFromIso(months[0]!);
  const { end } = monthRangeFromIso(months[months.length - 1]!);

  const { data, error } = await supabase
    .from('transactions')
    .select('amount_cents, currency, direction, paid_on')
    .eq('household_id', householdId)
    .eq('status', 'paid')
    .gte('paid_on', start)
    .lt('paid_on', end);

  if (error) throw new Error(`loadMonthlyFlow: ${error.message}`);

  const byMonth = new Map<string, { incomeCents: number; expenseCents: number }>();
  let fxIncomplete = false;

  for (const t of data ?? []) {
    if (!t.paid_on) continue;
    const converted = convertToTarget(t.amount_cents, t.currency as Currency, currency, fxRateMap);
    if (converted === null) {
      fxIncomplete = true;
      continue;
    }
    const ym = t.paid_on.slice(0, 7);
    const bucket = byMonth.get(ym) ?? { incomeCents: 0, expenseCents: 0 };
    if (t.direction === 'income') bucket.incomeCents += converted;
    else bucket.expenseCents += converted;
    byMonth.set(ym, bucket);
  }

  return {
    months: months.map((ym) => {
      const bucket = byMonth.get(ym) ?? { incomeCents: 0, expenseCents: 0 };
      return {
        monthIso: ym,
        incomeCents: bucket.incomeCents,
        expenseCents: bucket.expenseCents,
        netCents: bucket.incomeCents - bucket.expenseCents,
      };
    }),
    fxIncomplete,
  };
}
