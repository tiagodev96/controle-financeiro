import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { endOfMonth, monthIso, monthRange } from '@/lib/dates';
import { cycleForPurchase } from './credit-card';

export type RecurringFrequency = 'monthly' | 'yearly';

export type RecurringRule = {
  id: string;
  title: string;
  amount_cents: number;
  currency: Currency;
  direction: 'expense' | 'income';
  category_id: string | null;
  account_id: string | null;
  day_of_month: number;
  frequency: RecurringFrequency;
  is_paused: boolean;
  active_from: string | null;
  active_until: string | null;
  credit_card_id: string | null;
  notes: string | null;
};

/**
 * Regra se aplica ao mês alvo (YYYY-MM): mensal sempre; anual só no
 * mês-aniversário de active_from, em qualquer ano.
 */
export function ruleAppliesToMonth(
  rule: { frequency: string; active_from: string | null },
  ym: string,
): boolean {
  if (rule.frequency !== 'yearly') return true;
  if (!rule.active_from) return false;
  return rule.active_from.slice(5, 7) === ym.slice(5, 7);
}

export type RecurringListResult = {
  active: RecurringRule[];
  paused: RecurringRule[];
  notGeneratedThisMonth: number;
};

export type VirtualRecurringOccurrence = {
  ruleId: string;
  title: string;
  amountCents: number;
  currency: Currency;
  direction: 'expense' | 'income';
  /**
   * Quando o dinheiro sai: day_of_month clampado no mês da cobrança; regra de
   * cartão desloca pro VENCIMENTO da fatura do ciclo (pode cair no mês seguinte).
   */
  occurredOn: string;
  categoryId: string | null;
  categoryName: string | null;
  creditCardId: string | null;
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
      'id, title, amount_cents, currency, direction, category_id, day_of_month, frequency, is_paused, active_from, active_until, credit_card_id, categories(name), credit_cards(closing_day, due_day)',
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
    frequency: RecurringFrequency;
    is_paused: boolean;
    active_from: string | null;
    active_until: string | null;
    credit_card_id: string | null;
    categories: { name: string } | null;
    credit_cards: { closing_day: number; due_day: number } | null;
  };

  const targetYm = monthIso(targetDate);
  const active = ((rules ?? []) as unknown as Row[]).filter((r) => {
    if (r.is_paused) return false;
    if (r.active_from && r.active_from >= end) return false;
    if (r.active_until && r.active_until < start) return false;
    return ruleAppliesToMonth(r, targetYm);
  });
  if (active.length === 0) return [];

  // Regra de conta é rastreada por occurred_on; regra de cartão por
  // purchased_on — o vencimento (occurred_on) dela pode cair no mês seguinte
  // e não pode contaminar o check do outro mês.
  const { data: generated } = await supabase
    .from('transactions')
    .select('source_recurring_rule_id, occurred_on, purchased_on')
    .eq('household_id', householdId)
    .or(
      `and(occurred_on.gte.${start},occurred_on.lt.${end}),and(purchased_on.gte.${start},purchased_on.lt.${end})`,
    )
    .in(
      'source_recurring_rule_id',
      active.map((r) => r.id),
    );
  const generatedByOccurred = new Set<string>();
  const generatedByPurchased = new Set<string>();
  for (const t of generated ?? []) {
    if (!t.source_recurring_rule_id) continue;
    if (t.occurred_on >= start && t.occurred_on < end) {
      generatedByOccurred.add(t.source_recurring_rule_id);
    }
    if (t.purchased_on && t.purchased_on >= start && t.purchased_on < end) {
      generatedByPurchased.add(t.source_recurring_rule_id);
    }
  }
  const isGenerated = (r: Row) =>
    r.credit_card_id ? generatedByPurchased.has(r.id) : generatedByOccurred.has(r.id);

  const lastDay = endOfMonth(targetDate).getDate();
  const monthPrefix = monthIso(targetDate);

  return active
    .filter((r) => !isGenerated(r))
    .map((r) => {
      const day = Math.min(r.day_of_month, lastDay);
      const chargeOn = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      const occurredOn =
        r.credit_card_id && r.credit_cards
          ? cycleForPurchase(chargeOn, r.credit_cards.closing_day, r.credit_cards.due_day).dueOn
          : chargeOn;
      return {
        ruleId: r.id,
        title: r.title,
        amountCents: r.amount_cents,
        currency: r.currency,
        direction: r.direction,
        occurredOn,
        categoryId: r.category_id,
        categoryName: r.categories?.name ?? null,
        creditCardId: r.credit_card_id,
      };
    });
}

/**
 * Ocorrências virtuais cujo DINHEIRO SAI no mês alvo. Difere da função acima
 * quando há regra de cartão: a cobrança do mês anterior vence neste mês, e a
 * deste mês pode vencer no seguinte. Varre os dois meses de cobrança e filtra
 * pelo occurredOn. É a fonte da projeção e dos previstos de /transacoes.
 */
export async function listUngeneratedRecurringDueInMonth({
  supabase,
  householdId,
  targetDate,
}: {
  supabase: SupabaseClient<Database>;
  householdId: string;
  targetDate: Date;
}): Promise<VirtualRecurringOccurrence[]> {
  const targetYm = monthIso(targetDate);
  const previousMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 15);

  const [fromPrevious, fromTarget] = await Promise.all([
    listUngeneratedRecurringForMonth({ supabase, householdId, targetDate: previousMonth }),
    listUngeneratedRecurringForMonth({ supabase, householdId, targetDate }),
  ]);

  return [...fromPrevious, ...fromTarget].filter((o) => o.occurredOn.slice(0, 7) === targetYm);
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
        'id, title, amount_cents, currency, direction, category_id, account_id, day_of_month, frequency, is_paused, active_from, active_until, credit_card_id, notes',
      )
      .eq('household_id', householdId)
      .order('day_of_month', { ascending: true }),
    supabase
      .from('transactions')
      .select('source_recurring_rule_id, occurred_on, purchased_on')
      .eq('household_id', householdId)
      .or(
        `and(occurred_on.gte.${start},occurred_on.lt.${end}),and(purchased_on.gte.${start},purchased_on.lt.${end})`,
      )
      .not('source_recurring_rule_id', 'is', null),
  ]);

  if (rulesRes.error) throw new Error(`listRecurringRules: ${rulesRes.error.message}`);
  if (txnsRes.error) throw new Error(`listRecurringRules (tx): ${txnsRes.error.message}`);

  const rules = (rulesRes.data ?? []) as RecurringRule[];
  const generatedByOccurred = new Set<string>();
  const generatedByPurchased = new Set<string>();
  for (const t of txnsRes.data ?? []) {
    if (!t.source_recurring_rule_id) continue;
    if (t.occurred_on >= start && t.occurred_on < end) {
      generatedByOccurred.add(t.source_recurring_rule_id);
    }
    if (t.purchased_on && t.purchased_on >= start && t.purchased_on < end) {
      generatedByPurchased.add(t.source_recurring_rule_id);
    }
  }

  const currentYm = monthIso(now);
  const active: RecurringRule[] = [];
  const paused: RecurringRule[] = [];
  let notGeneratedThisMonth = 0;

  for (const r of rules) {
    if (r.is_paused) {
      paused.push(r);
    } else {
      active.push(r);
      // Anual fora do mês-aniversário não está "faltando" — não conta.
      const generated = r.credit_card_id
        ? generatedByPurchased.has(r.id)
        : generatedByOccurred.has(r.id);
      if (!generated && ruleAppliesToMonth(r, currentYm)) {
        notGeneratedThisMonth += 1;
      }
    }
  }

  return { active, paused, notGeneratedThisMonth };
}
