import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import {
  calculateMonthStats,
  topCategoriesThisMonth,
  type MonthStats,
} from './dashboard-stats';

export type ProjectionTopCategory = {
  id: string;
  name: string;
  totalCents: number;
};

export type MonthProjection = {
  /** Base stats do mês alvo (paid normalmente 0; pending = installments + outras). */
  stats: MonthStats;
  /** Soma das recurring rules ativas no mês que ainda não geraram transaction. */
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
};

function monthBoundaries(targetDate: Date): { start: string; end: string } {
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

/**
 * Projeção pra um mês futuro: combina pending já no banco (installments,
 * txns criadas à mão) com recurring rules ativas que ainda não geraram
 * transaction pro mês alvo (virtualizadas pra preview).
 *
 * Não materializa nada no banco — é só simulação pra UI mostrar "se nada
 * mudar, esse vai ser o resultado do mês".
 */
export async function projectMonthForFuture({
  supabase,
  householdId,
  currency,
  balanceCents,
  targetDate,
  topCategoriesLimit = 3,
}: {
  supabase: SupabaseClient<Database>;
  householdId: string;
  currency: Currency;
  balanceCents: number;
  targetDate: Date;
  topCategoriesLimit?: number;
}): Promise<MonthProjection> {
  const { start, end } = monthBoundaries(targetDate);

  const [stats, topCatsReal, rulesRes] = await Promise.all([
    calculateMonthStats(supabase, householdId, currency, balanceCents, targetDate),
    topCategoriesThisMonth(supabase, householdId, currency, 10, targetDate),
    supabase
      .from('recurring_rules')
      .select(
        'id, amount_cents, currency, direction, category_id, is_paused, active_from, active_until',
      )
      .eq('household_id', householdId)
      .eq('currency', currency),
  ]);

  const activeRules = (rulesRes.data ?? []).filter((r) => {
    if (r.is_paused) return false;
    if (r.active_from && r.active_from > end) return false;
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
  const virtualByCategory = new Map<string, number>();

  for (const rule of ungenerated) {
    if (rule.direction === 'expense') {
      recurringPendingExpenseCents += rule.amount_cents;
      if (rule.category_id) {
        virtualByCategory.set(
          rule.category_id,
          (virtualByCategory.get(rule.category_id) ?? 0) + rule.amount_cents,
        );
      }
    } else {
      recurringPendingIncomeCents += rule.amount_cents;
    }
  }

  // Resolve nomes das categorias virtuais (que não apareceram em topCatsReal).
  const missingCategoryIds = Array.from(virtualByCategory.keys()).filter(
    (id) => !topCatsReal.some((c) => c.id === id),
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
  for (const c of topCatsReal) {
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
    stats.paid.totalCents + stats.pending.totalCents + recurringPendingExpenseCents;
  const incomeProjectedCents = stats.incomePaid.totalCents + recurringPendingIncomeCents;
  const sobraProjetadaCents =
    balanceCents + incomeProjectedCents - expenseProjectedCents;

  return {
    stats,
    recurringPendingExpenseCents,
    recurringPendingIncomeCents,
    expenseProjectedCents,
    incomeProjectedCents,
    sobraProjetadaCents,
    topCategoriesProjected,
  };
}
