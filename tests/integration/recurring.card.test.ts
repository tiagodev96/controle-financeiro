import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateRecurringForMonthCore } from '@/server/actions/recurring/generate-core';
import { createRecurringCore } from '@/server/actions/recurring/core';
import { createCreditCardCore } from '@/server/actions/credit-cards/core';
import { listUngeneratedRecurringDueInMonth } from '@/lib/finance/recurring';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'RRC test %');
  await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'CARD test %');
  await admin
    .from('credit_cards')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('name', 'CARD test %');
}

async function setupCardRule(dayOfMonth: number) {
  const supabase = await getAuthedClient();
  const card = await createCreditCardCore(
    { supabase, session: SEED_SESSION },
    {
      name: 'CARD test recorrente',
      closingDay: 7,
      dueDay: 11,
      creditLimitCents: null,
      paymentAccountId: SEED_ACCOUNT_BRL_ID,
    },
  );
  if (!card.ok) throw new Error(`setup card: ${card.error}`);

  const rule = await createRecurringCore(
    { supabase, session: SEED_SESSION },
    {
      title: 'RRC test Google One',
      amountCents: 4999,
      direction: 'expense',
      categoryId: SEED_CATEGORY_MERCADO_ID,
      creditCardId: card.card.id,
      dayOfMonth,
      frequency: 'monthly',
      notes: null,
    },
  );
  if (!rule.ok) throw new Error(`setup rule: ${rule.error}`);
  return { supabase, card: card.card, rule: rule.rule };
}

describe('recorrente no cartão (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-RRC1 — regra com cartão herda conta e moeda da conta que paga a fatura', async () => {
    const { rule, card } = await setupCardRule(15);
    expect(rule.credit_card_id).toBe(card.id);
    expect(rule.account_id).toBe(SEED_ACCOUNT_BRL_ID);
    expect(rule.currency).toBe('BRL');
  });

  it('I-RRC2 — geração vira compra de cartão: cobrança dia 15 cai na fatura do mês seguinte', async () => {
    const { supabase, card } = await setupCardRule(15);
    const result = await generateRecurringForMonthCore(
      { supabase, session: SEED_SESSION },
      { monthIso: '2026-09' },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(1);

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select('purchased_on, occurred_on, credit_card_id, account_id, currency, amount_cents, status')
      .eq('credit_card_id', card.id);
    expect(txns).toHaveLength(1);
    expect(txns![0]).toMatchObject({
      purchased_on: '2026-09-15',
      occurred_on: '2026-10-11',
      credit_card_id: card.id,
      account_id: SEED_ACCOUNT_BRL_ID,
      currency: 'BRL',
      amount_cents: 4999,
      status: 'pending',
    });
  });

  it('I-RRC3 — cobrança antes do fechamento (dia 5) vence no mesmo mês', async () => {
    const { supabase, card } = await setupCardRule(5);
    await generateRecurringForMonthCore(
      { supabase, session: SEED_SESSION },
      { monthIso: '2026-09' },
    );
    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select('purchased_on, occurred_on')
      .eq('credit_card_id', card.id);
    expect(txns![0]).toMatchObject({ purchased_on: '2026-09-05', occurred_on: '2026-09-11' });
  });

  it('I-RRC4 — idempotência é pelo mês da COBRANÇA: outubro gera de novo mesmo com occurred_on em outubro', async () => {
    const { supabase, card } = await setupCardRule(15);
    // Setembro: cobrança 15/09, occurred 11/10.
    const first = await generateRecurringForMonthCore(
      { supabase, session: SEED_SESSION },
      { monthIso: '2026-09' },
    );
    expect(first.ok && first.created).toBe(1);
    // Setembro de novo: pulado.
    const again = await generateRecurringForMonthCore(
      { supabase, session: SEED_SESSION },
      { monthIso: '2026-09' },
    );
    expect(again.ok && again.skipped).toBe(1);
    // Outubro: a txn de setembro tem occurred_on em outubro, mas NÃO pode
    // bloquear a cobrança de outubro (15/10 → 11/11).
    const oct = await generateRecurringForMonthCore(
      { supabase, session: SEED_SESSION },
      { monthIso: '2026-10' },
    );
    expect(oct.ok && oct.created).toBe(1);

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select('purchased_on, occurred_on')
      .eq('credit_card_id', card.id)
      .order('purchased_on', { ascending: true });
    expect(txns!.map((t) => [t.purchased_on, t.occurred_on])).toEqual([
      ['2026-09-15', '2026-10-11'],
      ['2026-10-15', '2026-11-11'],
    ]);
  });

  it('I-RRC5 — virtual: cobrança de setembro não gerada aparece como prevista de OUTUBRO (mês do vencimento)', async () => {
    const { supabase } = await setupCardRule(15);

    const september = await listUngeneratedRecurringDueInMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetDate: new Date(2026, 8, 15),
    });
    expect(september.filter((o) => o.title === 'RRC test Google One')).toHaveLength(0);

    const october = await listUngeneratedRecurringDueInMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetDate: new Date(2026, 9, 15),
    });
    const occ = october.find((o) => o.title === 'RRC test Google One');
    expect(occ).toBeDefined();
    expect(occ!.occurredOn).toBe('2026-10-11');
  });

  it('I-RRC6 — regra de cartão com direction income é rejeitada', async () => {
    const supabase = await getAuthedClient();
    const card = await createCreditCardCore(
      { supabase, session: SEED_SESSION },
      {
        name: 'CARD test income',
        closingDay: 7,
        dueDay: 11,
        creditLimitCents: null,
        paymentAccountId: SEED_ACCOUNT_BRL_ID,
      },
    );
    if (!card.ok) throw new Error('setup');
    const rule = await createRecurringCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'RRC test cashback',
        amountCents: 1000,
        direction: 'income',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        creditCardId: card.card.id,
        dayOfMonth: 10,
        frequency: 'monthly',
        notes: null,
      },
    );
    expect(rule.ok).toBe(false);
  });
});
