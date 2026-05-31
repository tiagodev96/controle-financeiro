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

export type VirtualRecurringOccurrence = {
  ruleId: string;
  title: string;
  amountCents: number;
  currency: Currency;
  direction: 'expense' | 'income';
  /** day_of_month da regra clampado ao último dia do mês alvo (YYYY-MM-DD). */
  occurredOn: string;
  categoryId: string | null;
  categoryName: string | null;
};

/**
 * Ocorrências virtuais das regras recorrentes ativas que ainda NÃO geraram
 * transaction no mês alvo. Não materializa nada — é a fonte única usada tanto
 * pela sobra projetada quanto pelo preview de transações de mês futuro.
 *
 * Ativa no mês: não-pausada, active_from < fim do mês, active_until >= início.
 */
export async function listUngeneratedRecurringForMonth({
  supabase,
  householdId,
  targetDate,
}: {
  supabase: SupabaseClient<Database>;
  householdId: string;
  targetDate: Date;
}): Promise<VirtualRecurringOccurrence[]> {
  const { start, end } = monthRange(targetDate);

  const { data: rules, error } = await supabase
    .from('recurring_rules')
    .select(
      'id, title, amount_cents, currency, direction, category_id, day_of_month, is_paused, active_from, active_until, categories(name)',
    )
    .eq('household_id', householdId)
    .order('day_of_month', { ascending: true });
  if (error) throw new Error(`listUngeneratedRecurringForMonth: ${error.message}`);

  type Row = {
    id: string;
    title: string;
    amount_cents: number;
    currency: Currency;
    direction: 'expense' | 'income';
    category_id: string | null;
    day_of_month: number;
    is_paused: boolean;
    active_from: string | null;
    active_until: string | null;
    categories: { name: string } | null;
  };

  const active = ((rules ?? []) as unknown as Row[]).filter((r) => {
    if (r.is_paused) return false;
    if (r.active_from && r.active_from >= end) return false;
    if (r.active_until && r.active_until < start) return false;
    return true;
  });
  if (active.length === 0) return [];

  const { data: generated } = await supabase
    .from('transactions')
    .select('source_recurring_rule_id')
    .eq('household_id', householdId)
    .gte('occurred_on', start)
    .lt('occurred_on', end)
    .in(
      'source_recurring_rule_id',
      active.map((r) => r.id),
    );
  const generatedIds = new Set(
    (generated ?? [])
      .map((t) => t.source_recurring_rule_id)
      .filter((id): id is string => !!id),
  );

  const y = targetDate.getFullYear();
  const m = targetDate.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  // Prefixo do mês direto do targetDate local — evita o shift de timezone que
  // `monthRange` (via toISOString) introduz na borda do mês.
  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}`;

  return active
    .filter((r) => !generatedIds.has(r.id))
    .map((r) => {
      const day = Math.min(r.day_of_month, lastDay);
      return {
        ruleId: r.id,
        title: r.title,
        amountCents: r.amount_cents,
        currency: r.currency,
        direction: r.direction,
        occurredOn: `${monthPrefix}-${String(day).padStart(2, '0')}`,
        categoryId: r.category_id,
        categoryName: r.categories?.name ?? null,
      };
    });
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
