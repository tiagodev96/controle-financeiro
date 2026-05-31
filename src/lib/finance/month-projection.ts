import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, type RateMap } from '@/lib/fx';
import {
  calculateCrossCurrencyMonthStats,
  type CrossCurrencyMonthStats,
} from './cross-currency-stats';
import { listUngeneratedRecurringForMonth } from './recurring';

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
 * Projeção pra mês futuro em `targetCurrency`: combina pending já no banco
 * (installments, txns criadas à mão) com recurring rules ativas que ainda
 * não geraram transaction (virtualizadas pra preview). Tudo agregado em
 * `targetCurrency` via fxRateMap.
 *
 * Não materializa nada no banco — é só simulação pra UI.
 */
export async function projectMonthForFuture({
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
    listUngeneratedRecurringForMonth({ supabase, householdId, targetDate }),
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

  const expenseProjectedCents =
    stats.paidExpenseCents + stats.pendingExpenseCents + recurringPendingExpenseCents;
  const incomeProjectedCents = stats.paidIncomeCents + recurringPendingIncomeCents;
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
