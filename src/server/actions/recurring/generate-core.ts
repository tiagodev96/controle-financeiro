import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { monthRangeFromIso } from '@/lib/dates';
import { ruleAppliesToMonth } from '@/lib/finance/recurring';
import { cycleForPurchase } from '@/lib/finance/credit-card';

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
      'id, title, amount_cents, currency, direction, category_id, account_id, day_of_month, frequency, is_paused, active_from, active_until, credit_card_id, credit_cards(closing_day, due_day, payment_account_id, is_archived)',
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
  // Regra de conta é idempotente por occurred_on no mês; regra de cartão por
  // purchased_on — o vencimento dela pode cair no mês seguinte e não pode
  // bloquear a geração do próximo ciclo.
  const { data: existing } = await supabase
    .from('transactions')
    .select('source_recurring_rule_id, occurred_on, purchased_on')
    .eq('household_id', session.householdId)
    .or(
      `and(occurred_on.gte.${start},occurred_on.lt.${end}),and(purchased_on.gte.${start},purchased_on.lt.${end})`,
    )
    .in('source_recurring_rule_id', ruleIds);

  const generatedByOccurred = new Set<string>();
  const generatedByPurchased = new Set<string>();
  for (const t of existing ?? []) {
    if (!t.source_recurring_rule_id) continue;
    if (t.occurred_on >= start && t.occurred_on < end) {
      generatedByOccurred.add(t.source_recurring_rule_id);
    }
    if (t.purchased_on && t.purchased_on >= start && t.purchased_on < end) {
      generatedByPurchased.add(t.source_recurring_rule_id);
    }
  }

  const toInsert: Database['public']['Tables']['transactions']['Insert'][] = [];
  let skipped = 0;
  let failed = 0;

  for (const rule of activeRules) {
    const card = Array.isArray(rule.credit_cards) ? rule.credit_cards[0] : rule.credit_cards;
    const generated = rule.credit_card_id
      ? generatedByPurchased.has(rule.id)
      : generatedByOccurred.has(rule.id);
    if (generated) {
      skipped += 1;
      continue;
    }
    if (!rule.category_id || !rule.account_id) {
      failed += 1;
      continue;
    }
    const chargeOn = dateOfRule(monthIso, rule.day_of_month, lastDay);

    if (rule.credit_card_id) {
      // Cobrança na fatura: compra de cartão vencendo no ciclo da cobrança.
      if (!card || card.is_archived) {
        failed += 1;
        continue;
      }
      toInsert.push({
        household_id: session.householdId,
        profile_id: session.userId,
        account_id: card.payment_account_id,
        category_id: rule.category_id,
        direction: rule.direction,
        amount_cents: rule.amount_cents,
        currency: rule.currency,
        description: rule.title,
        occurred_on: cycleForPurchase(chargeOn, card.closing_day, card.due_day).dueOn,
        purchased_on: chargeOn,
        credit_card_id: rule.credit_card_id,
        status: 'pending',
        source_recurring_rule_id: rule.id,
      });
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
      occurred_on: chargeOn,
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
