import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';

export type InstallmentPlanFull = {
  id: string;
  title: string;
  total_amount_cents: number;
  currency: Currency;
  total_installments: number;
  first_due_date: string;
  frequency_months: number;
  category_id: string | null;
  account_id: string | null;
  notes: string | null;
};

export type InstallmentPlanWithProgress = InstallmentPlanFull & {
  paidCount: number;
  pendingCount: number;
  totalCount: number;
  isFinished: boolean;
};

/**
 * Divide o total em N parcelas inteiras (cents) cuja soma == total.
 * Distribui o resto entre as primeiras parcelas (até 1 cent extra cada).
 */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Adiciona n meses a uma data ISO (YYYY-MM-DD), clampando ao último dia do
 * mês alvo. Evita o overflow padrão do JS (Jan 31 + 1 = Mar 3).
 */
export function addMonthsClamped(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Lista planos do household com contagem de parcelas pagas/pendentes.
 * Calcula `isFinished` via aggregate em transactions ligadas.
 */
export async function listInstallmentPlansForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<{ active: InstallmentPlanWithProgress[]; finished: InstallmentPlanWithProgress[] }> {
  const { data: plans, error } = await supabase
    .from('installment_plans')
    .select(
      'id, title, total_amount_cents, currency, total_installments, first_due_date, frequency_months, category_id, account_id, notes',
    )
    .eq('household_id', householdId)
    .order('first_due_date', { ascending: true });

  if (error) throw new Error(`listInstallmentPlansForHousehold: ${error.message}`);

  const planList = (plans ?? []) as InstallmentPlanFull[];
  if (planList.length === 0) return { active: [], finished: [] };

  const ids = planList.map((p) => p.id);
  const { data: txns } = await supabase
    .from('transactions')
    .select('source_installment_plan_id, status')
    .in('source_installment_plan_id', ids);

  const countByPlan = new Map<string, { paid: number; pending: number }>();
  for (const t of txns ?? []) {
    if (!t.source_installment_plan_id) continue;
    const cur = countByPlan.get(t.source_installment_plan_id) ?? { paid: 0, pending: 0 };
    if (t.status === 'paid') cur.paid += 1;
    else cur.pending += 1;
    countByPlan.set(t.source_installment_plan_id, cur);
  }

  const enriched: InstallmentPlanWithProgress[] = planList.map((p) => {
    const c = countByPlan.get(p.id) ?? { paid: 0, pending: 0 };
    return {
      ...p,
      paidCount: c.paid,
      pendingCount: c.pending,
      totalCount: p.total_installments,
      isFinished: c.pending === 0 && c.paid > 0,
    };
  });

  return {
    active: enriched.filter((p) => !p.isFinished),
    finished: enriched.filter((p) => p.isFinished),
  };
}
