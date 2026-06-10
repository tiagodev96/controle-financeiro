import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { monthRangeFromIso } from '@/lib/dates';
import { ruleAppliesToMonth } from '@/lib/finance/recurring';

const GENERIC = 'Não foi possível gerar.';

const inputSchema = z.object({
  monthIso: z.string().regex(/^\d{4}-\d{2}$/, 'monthIso inválido'),
});

export type GenerateInput = z.input<typeof inputSchema>;
export type GenerateResult =
  | { ok: true; created: number; skipped: number; failed: number }
  | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

function monthRange(monthIso: string): { start: string; end: string; lastDay: number } {
  const { start, end } = monthRangeFromIso(monthIso);
  const [y, m] = monthIso.split('-').map(Number);
  return { start, end, lastDay: new Date(y!, m!, 0).getDate() };
}

function dateOfRule(monthIso: string, dayOfMonth: number, lastDay: number): string {
  const day = Math.min(dayOfMonth, lastDay);
  return `${monthIso}-${String(day).padStart(2, '0')}`;
}

/**
 * Gera transactions pending pra todas as regras ativas do mês.
 * Idempotente — pula regra que já tem transaction no mês com mesma source.
 */
export async function generateRecurringForMonthCore(
  { supabase, session }: Deps,
  input: GenerateInput,
): Promise<GenerateResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { monthIso } = parsed.data;
  const { start, end, lastDay } = monthRange(monthIso);

  const { data: rules, error: rulesError } = await supabase
    .from('recurring_rules')
    .select(
      'id, title, amount_cents, currency, direction, category_id, account_id, day_of_month, frequency, is_paused, active_from, active_until',
    )
    .eq('household_id', session.householdId);
  if (rulesError) return { ok: false, error: GENERIC };

  const activeRules = (rules ?? []).filter((r) => {
    if (r.is_paused) return false;
    // `end` é exclusivo (1º dia do mês seguinte): regra ativa no mês exige
    // active_from < end. Com `>` uma regra que começa no 1º dia do próximo
    // mês vazava pro mês corrente, gerando transação espúria no mês anterior.
    if (r.active_from && r.active_from >= end) return false;
    if (r.active_until && r.active_until < start) return false;
    return ruleAppliesToMonth(r, monthIso);
  });

  if (activeRules.length === 0) {
    return { ok: true, created: 0, skipped: 0, failed: 0 };
  }

  const ruleIds = activeRules.map((r) => r.id);
  const { data: existing } = await supabase
    .from('transactions')
    .select('source_recurring_rule_id')
    .eq('household_id', session.householdId)
    .gte('occurred_on', start)
    .lt('occurred_on', end)
    .in('source_recurring_rule_id', ruleIds);

  const alreadyGenerated = new Set(
    (existing ?? []).map((t) => t.source_recurring_rule_id).filter((id): id is string => !!id),
  );

  const toInsert: Database['public']['Tables']['transactions']['Insert'][] = [];
  let skipped = 0;
  let failed = 0;

  for (const rule of activeRules) {
    if (alreadyGenerated.has(rule.id)) {
      skipped += 1;
      continue;
    }
    if (!rule.category_id || !rule.account_id) {
      failed += 1;
      continue;
    }
    toInsert.push({
      household_id: session.householdId,
      profile_id: session.userId,
      account_id: rule.account_id,
      category_id: rule.category_id,
      direction: rule.direction,
      amount_cents: rule.amount_cents,
      currency: rule.currency,
      description: rule.title,
      occurred_on: dateOfRule(monthIso, rule.day_of_month, lastDay),
      status: 'pending',
      source_recurring_rule_id: rule.id,
    });
  }

  if (toInsert.length === 0) {
    return { ok: true, created: 0, skipped, failed };
  }

  const { error: insertError } = await supabase.from('transactions').insert(toInsert);
  if (insertError) return { ok: false, error: GENERIC };

  return { ok: true, created: toInsert.length, skipped, failed };
}
