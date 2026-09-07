import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, type RateMap } from '@/lib/fx';
import {
  calculateCrossCurrencyMonthStats,
  type CrossCurrencyMonthStats,
} from './cross-currency-stats';
import { listUngeneratedRecurringDueInMonth } from './recurring';
import { addMonths, monthIso } from '@/lib/dates';

export type ProjectionTopCategory = {
  id: string;
  name: string;
  totalCents: number;
};

export type MonthProjection = {
  /** Stats cross-currency em targetCurrency (paid normalmente 0; pending = installments + outras). */
  stats: CrossCurrencyMonthStats;
  /** Soma das recurring rules ativas no mês que ainda não geraram transaction (em targetCurrency). */
  recurringPendingExpenseCents: number;
  recurringPendingIncomeCents: number;
  /** Despesas totais projetadas (pending real + recurring virtual). */
  expenseProjectedCents: number;
  /** Entradas totais projetadas (pending real + recurring virtual). */
  incomeProjectedCents: number;
  /** balance + entradas projetadas - despesas projetadas. */
  sobraProjetadaCents: number;
  /** Top categorias somando despesas reais + recurring virtual. */
  topCategoriesProjected: ProjectionTopCategory[];
  /** True se algum txn ou rule em currency diferente da target ficou fora por fx. */
  fxIncomplete: boolean;
};

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
 * Projeção do mês (corrente ou futuro) em `targetCurrency`: saldo + pending já
 * no banco (installments, txns à mão) + recurring rules ativas que ainda não
 * geraram transaction (virtualizadas). Tudo agregado em `targetCurrency` via
 * fxRateMap. `paid` não entra na sobra — já está no saldo.
 *
 * Não materializa nada no banco — é só simulação pra UI.
 */
export async function projectMonth({
  supabase,
  householdId,
  targetCurrency,
  fxRateMap,
  accountsTotalInTargetCents,
  targetDate,
  now,
  topCategoriesLimit = 3,
}: {
  supabase: SupabaseClient<Database>;
  householdId: string;
  targetCurrency: Currency;
  fxRateMap: RateMap | null;
  accountsTotalInTargetCents: number;
  targetDate: Date;
  /** Data real de hoje — usada pro corte de "em atraso" do mês alvo. */
  now: Date;
  topCategoriesLimit?: number;
}): Promise<MonthProjection> {
  // Fonte única das recorrentes virtuais (mesma usada pelo preview da lista).
  const [stats, occurrences] = await Promise.all([
    calculateCrossCurrencyMonthStats({
      supabase,
      householdId,
      targetCurrency,
      fxRateMap,
      accountsTotalInTargetCents,
      targetDate,
      nowDate: now,
      topCategoriesLimit: 10, // mais larga aqui; recortamos no fim depois de mergear virtuais
    }),
    listUngeneratedRecurringDueInMonth({ supabase, householdId, targetDate }),
  ]);

  let recurringPendingExpenseCents = 0;
  let recurringPendingIncomeCents = 0;
  let recurringFxIncomplete = false;
  const virtualByCategory = new Map<string, { name: string; cents: number }>();

  for (const occ of occurrences) {
    const converted = convertToTarget(occ.amountCents, occ.currency, targetCurrency, fxRateMap);
    if (converted === null) {
      recurringFxIncomplete = true;
      continue;
    }
    if (occ.direction === 'expense') {
      recurringPendingExpenseCents += converted;
      if (occ.categoryId) {
        const cur = virtualByCategory.get(occ.categoryId) ?? {
          name: occ.categoryName ?? '—',
          cents: 0,
        };
        cur.cents += converted;
        virtualByCategory.set(occ.categoryId, cur);
      }
    } else {
      recurringPendingIncomeCents += converted;
    }
  }

  const mergedTopByCategory = new Map<string, ProjectionTopCategory>();
  for (const c of stats.topCategories) {
    mergedTopByCategory.set(c.id, { id: c.id, name: c.name, totalCents: c.totalCents });
  }
  for (const [catId, { name, cents }] of virtualByCategory.entries()) {
    const existing = mergedTopByCategory.get(catId);
    if (existing) {
      existing.totalCents += cents;
    } else {
      mergedTopByCategory.set(catId, { id: catId, name, totalCents: cents });
    }
  }

  const topCategoriesProjected = Array.from(mergedTopByCategory.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, topCategoriesLimit);

  // Paid já está refletido no saldo (accountsTotal) — não recontar. A sobra é
  // saldo + o que ainda vai entrar/sair: pending real (inclusive atrasada do
  // próprio mês, que ainda vai ser paga) + recorrente virtual.
  const expenseProjectedCents =
    stats.pendingExpenseCents + stats.overdueInMonthCents + recurringPendingExpenseCents;
  const incomeProjectedCents = stats.pendingIncomeCents + recurringPendingIncomeCents;
  const sobraProjetadaCents =
    accountsTotalInTargetCents + incomeProjectedCents - expenseProjectedCents;

  return {
    stats,
    recurringPendingExpenseCents,
    recurringPendingIncomeCents,
    expenseProjectedCents,
    incomeProjectedCents,
    sobraProjetadaCents,
    topCategoriesProjected,
    fxIncomplete: stats.fxIncomplete || recurringFxIncomplete,
  };
}

/** Teto de iteração da cadeia — mês além disso volta pro cálculo plano. */
const MAX_CHAIN_MONTHS = 12;

/**
 * Projeção ENCADEADA: pra mês futuro, a base não é o saldo de hoje — é a
 * sobra projetada do mês anterior, mês a mês, a partir do corrente. Assim
 * "outubro" já desconta o que ainda vai entrar/sair de setembro. No mês
 * corrente (ou passado) delega direto pro projectMonth.
 */
export async function projectMonthChained({
  supabase,
  householdId,
  targetCurrency,
  fxRateMap,
  accountsTotalInTargetCents,
  targetDate,
  now,
  topCategoriesLimit,
}: {
  supabase: SupabaseClient<Database>;
  householdId: string;
  targetCurrency: Currency;
  fxRateMap: RateMap | null;
  accountsTotalInTargetCents: number;
  targetDate: Date;
  now: Date;
  topCategoriesLimit?: number;
}): Promise<MonthProjection> {
  const currentYm = monthIso(now);
  const targetYm = monthIso(targetDate);

  let monthsAhead = 0;
  for (let ym = currentYm; ym < targetYm && monthsAhead <= MAX_CHAIN_MONTHS; ym = addMonths(ym, 1)) {
    monthsAhead += 1;
  }

  if (targetYm <= currentYm || monthsAhead > MAX_CHAIN_MONTHS) {
    return projectMonth({
      supabase,
      householdId,
      targetCurrency,
      fxRateMap,
      accountsTotalInTargetCents,
      targetDate,
      now,
      topCategoriesLimit,
    });
  }

  // Percorre do mês corrente até o anterior ao alvo; cada sobra vira a base
  // do mês seguinte.
  let baseCents = accountsTotalInTargetCents;
  for (let ym = currentYm; ym < targetYm; ym = addMonths(ym, 1)) {
    const [y, m] = ym.split('-').map(Number) as [number, number];
    const endOfThatMonth = new Date(y, m, 0);
    const step = await projectMonth({
      supabase,
      householdId,
      targetCurrency,
      fxRateMap,
      accountsTotalInTargetCents: baseCents,
      targetDate: endOfThatMonth,
      now,
      topCategoriesLimit: 1,
    });
    baseCents = step.sobraProjetadaCents;
  }

  return projectMonth({
    supabase,
    householdId,
    targetCurrency,
    fxRateMap,
    accountsTotalInTargetCents: baseCents,
    targetDate,
    now,
    topCategoriesLimit,
  });
}
