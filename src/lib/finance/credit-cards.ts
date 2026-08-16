import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { cycleForDueDate, openCycleOn } from './credit-card';

export type CreditCardFull = {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  credit_limit_cents: number | null;
  payment_account_id: string;
  is_archived: boolean;
  sort_order: number;
};

export type InvoiceState = 'open' | 'closed' | 'paid' | 'future';

export type CardInvoice = {
  dueOn: string;
  opensOn: string;
  closesOn: string;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  count: number;
  state: InvoiceState;
};

export async function listCreditCardsForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<CreditCardFull[]> {
  const { data, error } = await supabase
    .from('credit_cards')
    .select('id, name, closing_day, due_day, credit_limit_cents, payment_account_id, is_archived, sort_order')
    .eq('household_id', householdId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(`listCreditCardsForHousehold: ${error.message}`);
  return (data ?? []) as CreditCardFull[];
}

export type CardPurchaseRow = {
  id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  occurred_on: string;
  purchased_on: string | null;
  status: 'pending' | 'paid';
  category_id: string | null;
  installment_number: number | null;
  source_installment_plan_id: string | null;
};

/**
 * Fatura é derivada: agrupa as compras do cartão por vencimento (occurred_on).
 * Estado sai da comparação com o ciclo aberto de `todayIso`:
 * dueOn igual → open; menor → closed (ou paid se nada pendente); maior → future.
 */
export async function listInvoicesForCard(
  supabase: SupabaseClient<Database>,
  {
    cardId,
    closingDay,
    dueDay,
    todayIso,
  }: { cardId: string; closingDay: number; dueDay: number; todayIso: string },
): Promise<CardInvoice[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount_cents, occurred_on, status')
    .eq('credit_card_id', cardId);

  if (error) throw new Error(`listInvoicesForCard: ${error.message}`);

  const byDue = new Map<string, { total: number; paid: number; pending: number; count: number }>();
  for (const t of data ?? []) {
    const group = byDue.get(t.occurred_on) ?? { total: 0, paid: 0, pending: 0, count: 0 };
    group.total += t.amount_cents;
    group.count += 1;
    if (t.status === 'paid') group.paid += t.amount_cents;
    else group.pending += t.amount_cents;
    byDue.set(t.occurred_on, group);
  }

  const openDueOn = openCycleOn(todayIso, closingDay, dueDay).dueOn;

  return Array.from(byDue.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dueOn, group]) => {
      const cycle = cycleForDueDate(dueOn, closingDay, dueDay);
      const state: InvoiceState =
        dueOn === openDueOn
          ? 'open'
          : dueOn > openDueOn
            ? 'future'
            : group.pending > 0
              ? 'closed'
              : 'paid';
      return {
        dueOn,
        opensOn: cycle.opensOn,
        closesOn: cycle.closesOn,
        totalCents: group.total,
        paidCents: group.paid,
        pendingCents: group.pending,
        count: group.count,
        state,
      };
    });
}

/** Compras de uma fatura específica, mais recentes primeiro (por data de compra). */
export async function listPurchasesForInvoice(
  supabase: SupabaseClient<Database>,
  { cardId, dueOn }: { cardId: string; dueOn: string },
): Promise<CardPurchaseRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, description, amount_cents, currency, occurred_on, purchased_on, status, category_id, installment_number, source_installment_plan_id',
    )
    .eq('credit_card_id', cardId)
    .eq('occurred_on', dueOn)
    .order('purchased_on', { ascending: false });

  if (error) throw new Error(`listPurchasesForInvoice: ${error.message}`);
  return (data ?? []) as CardPurchaseRow[];
}
