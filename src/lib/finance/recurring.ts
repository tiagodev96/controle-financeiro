import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';

export type RecurringRule = {
  id: string;
  title: string;
  amount_cents: number;
  currency: Currency;
  direction: 'expense' | 'income';
  category_id: string | null;
  account_id: string | null;
  day_of_month: number;
  is_paused: boolean;
  active_until: string | null;
  notes: string | null;
};

export type RecurringListResult = {
  active: RecurringRule[];
  paused: RecurringRule[];
  notGeneratedThisMonth: number;
};

function monthRange(now: Date): { start: string; end: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

/**
 * Lista todas regras do household + conta quantas regras ativas ainda não
 * têm transaction gerada no mês corrente (pra indicador no header).
 */
export async function listRecurringRulesForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
  now: Date = new Date(),
): Promise<RecurringListResult> {
  const { start, end } = monthRange(now);

  const [rulesRes, txnsRes] = await Promise.all([
    supabase
      .from('recurring_rules')
      .select(
        'id, title, amount_cents, currency, direction, category_id, account_id, day_of_month, is_paused, active_until, notes',
      )
      .eq('household_id', householdId)
      .order('day_of_month', { ascending: true }),
    supabase
      .from('transactions')
      .select('source_recurring_rule_id')
      .eq('household_id', householdId)
      .gte('occurred_on', start)
      .lt('occurred_on', end)
      .not('source_recurring_rule_id', 'is', null),
  ]);

  if (rulesRes.error) throw new Error(`listRecurringRules: ${rulesRes.error.message}`);
  if (txnsRes.error) throw new Error(`listRecurringRules (tx): ${txnsRes.error.message}`);

  const rules = (rulesRes.data ?? []) as RecurringRule[];
  const generatedIds = new Set(
    (txnsRes.data ?? [])
      .map((t) => t.source_recurring_rule_id)
      .filter((id): id is string => !!id),
  );

  const active: RecurringRule[] = [];
  const paused: RecurringRule[] = [];
  let notGeneratedThisMonth = 0;

  for (const r of rules) {
    if (r.is_paused) {
      paused.push(r);
    } else {
      active.push(r);
      if (!generatedIds.has(r.id)) notGeneratedThisMonth += 1;
    }
  }

  return { active, paused, notGeneratedThisMonth };
}
