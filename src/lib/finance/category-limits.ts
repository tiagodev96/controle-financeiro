import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';

export type LimitStatus = 'ok' | 'warning' | 'over';

export type CategoryLimit = {
  id: string;
  name: string;
  icon: string | null;
  limitCents: number;
  spentCents: number;
  pct: number;
  status: LimitStatus;
};

function monthRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

function statusFromPct(pct: number): LimitStatus {
  if (pct >= 1) return 'over';
  if (pct >= 0.8) return 'warning';
  return 'ok';
}

/**
 * Lista todas as categorias com `monthly_limit_cents` definido e calcula
 * o gasto do mês (paid + pending no mês corrente, currency específica).
 * Útil pro dashboard alertar quando alguma cat está perto ou ultrapassou.
 */
export async function listCategoriesWithLimits(
  supabase: SupabaseClient<Database>,
  householdId: string,
  currency: Currency,
  targetDate: Date = new Date(),
): Promise<CategoryLimit[]> {
  const { start, end } = monthRange(targetDate);

  const [catRes, txnRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, icon, monthly_limit_cents')
      .eq('household_id', householdId)
      .eq('kind', 'expense')
      .eq('is_archived', false)
      .not('monthly_limit_cents', 'is', null),
    supabase
      .from('transactions')
      .select('category_id, amount_cents, status')
      .eq('household_id', householdId)
      .eq('currency', currency)
      .eq('direction', 'expense')
      .gte('occurred_on', start)
      .lt('occurred_on', end),
  ]);

  const cats = catRes.data ?? [];
  const txns = txnRes.data ?? [];

  const spentByCat = new Map<string, number>();
  for (const t of txns) {
    if (!t.category_id) continue;
    // Conta paid + pending no mês — limite é "gasto previsto".
    spentByCat.set(t.category_id, (spentByCat.get(t.category_id) ?? 0) + t.amount_cents);
  }

  return cats
    .filter((c) => c.monthly_limit_cents != null && c.monthly_limit_cents > 0)
    .map((c) => {
      const limit = c.monthly_limit_cents as number;
      const spent = spentByCat.get(c.id) ?? 0;
      const pct = spent / limit;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon ?? null,
        limitCents: limit,
        spentCents: spent,
        pct,
        status: statusFromPct(pct),
      } satisfies CategoryLimit;
    })
    .sort((a, b) => b.pct - a.pct);
}
