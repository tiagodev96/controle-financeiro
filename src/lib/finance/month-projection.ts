import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, type RateMap } from '@/lib/fx';
import {
  calculateCrossCurrencyMonthStats,
  type CrossCurrencyMonthStats,
} from './cross-currency-stats';

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

function monthBoundaries(targetDate: Date): { start: string; end: string } {
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
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
  const { start, end } = monthBoundaries(targetDate);

  // 1) Stats cross-currency (pega installments + outras pending já no banco).
  // 2) Recurring rules de TODAS as currencies (filtra ativas em JS).
  const [stats, rulesRes] = await Promise.all([
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
    supabase
      .from('recurring_rules')
      .select(
        'id, amount_cents, currency, direction, category_id, is_paused, active_from, active_until',
      )
      .eq('household_id', householdId),
  ]);

  const activeRules = (rulesRes.data ?? []).filter((r) => {
    if (r.is_paused) return false;
    // `end` é exclusivo (1º dia do mês seguinte): ativa no mês exige active_from < end.
    if (r.active_from && r.active_from >= end) return false;
    if (r.active_until && r.active_until < start) return false;
    return true;
  });

  let alreadyGenerated = new Set<string>();
  if (activeRules.length > 0) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('source_recurring_rule_id')
      .eq('household_id', householdId)
      .gte('occurred_on', start)
      .lt('occurred_on', end)
      .in(
        'source_recurring_rule_id',
        activeRules.map((r) => r.id),
      );
    alreadyGenerated = new Set(
      (existing ?? [])
        .map((t) => t.source_recurring_rule_id)
        .filter((id): id is string => !!id),
    );
  }

  const ungenerated = activeRules.filter((r) => !alreadyGenerated.has(r.id));

  let recurringPendingExpenseCents = 0;
  let recurringPendingIncomeCents = 0;
  let recurringFxIncomplete = false;
  const virtualByCategory = new Map<string, number>();

  for (const rule of ungenerated) {
    const converted = convertToTarget(
      rule.amount_cents,
      rule.currency as Currency,
      targetCurrency,
      fxRateMap,
    );
    if (converted === null) {
      recurringFxIncomplete = true;
      continue;
    }
    if (rule.direction === 'expense') {
      recurringPendingExpenseCents += converted;
      if (rule.category_id) {
        virtualByCategory.set(
          rule.category_id,
          (virtualByCategory.get(rule.category_id) ?? 0) + converted,
        );
      }
    } else {
      recurringPendingIncomeCents += converted;
    }
  }

  // Resolve nomes das categorias virtuais (que não apareceram em stats.topCategories).
  const missingCategoryIds = Array.from(virtualByCategory.keys()).filter(
    (id) => !stats.topCategories.some((c) => c.id === id),
  );
  let categoryNameById = new Map<string, string>();
  if (missingCategoryIds.length > 0) {
    const { data: catRows } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', missingCategoryIds);
    categoryNameById = new Map((catRows ?? []).map((c) => [c.id, c.name]));
  }

  const mergedTopByCategory = new Map<string, ProjectionTopCategory>();
  for (const c of stats.topCategories) {
    mergedTopByCategory.set(c.id, { id: c.id, name: c.name, totalCents: c.totalCents });
  }
  for (const [catId, addCents] of virtualByCategory.entries()) {
    const existing = mergedTopByCategory.get(catId);
    if (existing) {
      existing.totalCents += addCents;
    } else {
      mergedTopByCategory.set(catId, {
        id: catId,
        name: categoryNameById.get(catId) ?? '—',
        totalCents: addCents,
      });
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
