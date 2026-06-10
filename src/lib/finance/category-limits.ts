import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, type RateMap } from '@/lib/fx';
import { monthRange } from '@/lib/dates';

export type LimitStatus = 'ok' | 'warning' | 'over';

export type CategoryLimit = {
  id: string;
  name: string;
  icon: string | null;
  /** Currency em que o limite foi definido (EUR ou BRL). */
  limitCurrency: Currency;
  limitCents: number;
  /** Gasto do mês na limitCurrency (cross-currency, já convertido via FX). */
  spentCents: number;
  pct: number;
  status: LimitStatus;
  /** True se algum gasto foi excluído por falta de FX (raro mas possível). */
  fxIncomplete: boolean;
};

function statusFromPct(pct: number): LimitStatus {
  if (pct >= 1) return 'over';
  if (pct >= 0.8) return 'warning';
  return 'ok';
}

/**
 * Converte um valor de uma currency pra outra usando fxRateMap.
 * Retorna null se a conversão for impossível (fxRateMap ausente).
 */
function convertToLimitCurrency(
  cents: number,
  from: Currency,
  to: Currency,
  fxRateMap: RateMap | null,
): number | null {
  if (from === to) return cents;
  if (!fxRateMap) return null;
  const rate = from === 'EUR' ? fxRateMap.EUR_BRL : fxRateMap.BRL_EUR;
  return convertCents(cents, rate);
}

/**
 * Lista categorias com `monthly_limit_cents` definido. Para cada uma, soma
 * gastos do mês em TODAS as currencies e converte cada um pra limitCurrency
 * da categoria antes de comparar com o limite.
 *
 * Se fxRateMap ausente e há gastos em currency diferente da do limite, esses
 * gastos viram 0 e flagga fxIncomplete=true.
 */
export async function listCategoriesWithLimits(
  supabase: SupabaseClient<Database>,
  householdId: string,
  fxRateMap: RateMap | null,
  targetDate: Date = new Date(),
): Promise<CategoryLimit[]> {
  const { start, end } = monthRange(targetDate);

  const [catRes, txnRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, icon, monthly_limit_cents, limit_currency')
      .eq('household_id', householdId)
      .eq('kind', 'expense')
      .eq('is_archived', false)
      .not('monthly_limit_cents', 'is', null),
    supabase
      .from('transactions')
      .select('category_id, amount_cents, currency')
      .eq('household_id', householdId)
      .eq('direction', 'expense')
      .gte('occurred_on', start)
      .lt('occurred_on', end),
  ]);

  const cats = catRes.data ?? [];
  const txns = txnRes.data ?? [];

  // Agrupa gastos por (categoria, currency) — vamos converter na hora.
  const byCatCurrency = new Map<string, Map<Currency, number>>();
  for (const t of txns) {
    if (!t.category_id) continue;
    const cur = t.currency as Currency;
    let inner = byCatCurrency.get(t.category_id);
    if (!inner) {
      inner = new Map();
      byCatCurrency.set(t.category_id, inner);
    }
    inner.set(cur, (inner.get(cur) ?? 0) + t.amount_cents);
  }

  return cats
    .filter((c) => c.monthly_limit_cents != null && c.monthly_limit_cents > 0)
    .map((c) => {
      const limit = c.monthly_limit_cents as number;
      // Fallback pra EUR se algum registro antigo escapou do backfill.
      const limitCurrency = (c.limit_currency as Currency | null) ?? 'EUR';
      let spent = 0;
      let fxIncomplete = false;
      const inner = byCatCurrency.get(c.id);
      if (inner) {
        for (const [cur, cents] of inner.entries()) {
          const converted = convertToLimitCurrency(cents, cur, limitCurrency, fxRateMap);
          if (converted === null) {
            fxIncomplete = true;
          } else {
            spent += converted;
          }
        }
      }
      const pct = spent / limit;
      return {
        id: c.id,
        name: c.name,
        icon: c.icon ?? null,
        limitCurrency,
        limitCents: limit,
        spentCents: spent,
        pct,
        status: statusFromPct(pct),
        fxIncomplete,
      } satisfies CategoryLimit;
    })
    .sort((a, b) => b.pct - a.pct);
}
