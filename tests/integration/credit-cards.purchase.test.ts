import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCreditCardCore } from '@/server/actions/credit-cards/core';
import { createCardPurchaseCore } from '@/server/actions/credit-cards/purchase-core';
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
    .from('installment_plans')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'CARD test %');
  await admin
    .from('credit_cards')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('name', 'CARD test %');
}

async function createCard() {
  const supabase = await getAuthedClient();
  const result = await createCreditCardCore(
    { supabase, session: SEED_SESSION },
    {
      name: 'CARD test compras',
      closingDay: 7,
      dueDay: 11,
      creditLimitCents: null,
      paymentAccountId: SEED_ACCOUNT_BRL_ID,
    },
  );
  if (!result.ok) throw new Error(`setup: ${result.error}`);
  return { supabase, card: result.card };
}

describe('compra no cartão (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-CARD-BUY1 — compra à vista dia 08/08 vira pending com vencimento 11/09 e moeda da conta', async () => {
    const { supabase, card } = await createCard();
    const result = await createCardPurchaseCore(
      { supabase, session: SEED_SESSION },
      {
        cardId: card.id,
        amountCents: 12050,
        description: 'CARD test mercado',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        purchasedOn: '2026-08-08',
        installments: 1,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dueOn).toBe('2026-09-11');

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select(
        'amount_cents, currency, status, paid_on, occurred_on, purchased_on, credit_card_id, account_id, direction',
      )
      .eq('credit_card_id', card.id);
    expect(txns).toHaveLength(1);
    const txn = txns![0]!;
    expect(txn.amount_cents).toBe(12050);
    expect(txn.currency).toBe('BRL');
    expect(txn.status).toBe('pending');
    expect(txn.paid_on).toBeNull();
    expect(txn.occurred_on).toBe('2026-09-11');
    expect(txn.purchased_on).toBe('2026-08-08');
    expect(txn.account_id).toBe(SEED_ACCOUNT_BRL_ID);
    expect(txn.direction).toBe('expense');
  });

  it('I-CARD-BUY2 — compra dia 06/08 (antes do fechamento) vence 11/08', async () => {
    const { supabase, card } = await createCard();
    const result = await createCardPurchaseCore(
      { supabase, session: SEED_SESSION },
      {
        cardId: card.id,
        amountCents: 5000,
        description: 'CARD test farmácia',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        purchasedOn: '2026-08-06',
        installments: 1,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dueOn).toBe('2026-08-11');
  });

  it('I-CARD-BUY3 — compra parcelada 3× cria plano com credit_card_id e parcelas em faturas consecutivas', async () => {
    const { supabase, card } = await createCard();
    const result = await createCardPurchaseCore(
      { supabase, session: SEED_SESSION },
      {
        cardId: card.id,
        amountCents: 30001,
        description: 'CARD test sofá',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        purchasedOn: '2026-08-08',
        installments: 3,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dueOn).toBe('2026-09-11');

    const admin = getAdminClient();
    const { data: plans } = await admin
      .from('installment_plans')
      .select('id, credit_card_id, total_amount_cents, total_installments, first_due_date, account_id')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .like('title', 'CARD test sofá%');
    expect(plans).toHaveLength(1);
    const plan = plans![0]!;
    expect(plan.credit_card_id).toBe(card.id);
    expect(plan.total_amount_cents).toBe(30001);
    expect(plan.first_due_date).toBe('2026-09-11');
    expect(plan.account_id).toBe(SEED_ACCOUNT_BRL_ID);

    const { data: txns } = await admin
      .from('transactions')
      .select('amount_cents, occurred_on, purchased_on, credit_card_id, installment_number, status')
      .eq('source_installment_plan_id', plan.id)
      .order('installment_number', { ascending: true });
    expect(txns).toHaveLength(3);
    expect(txns!.map((t) => t.occurred_on)).toEqual(['2026-09-11', '2026-10-11', '2026-11-11']);
    expect(txns!.map((t) => t.amount_cents)).toEqual([10001, 10000, 10000]);
    expect(txns!.every((t) => t.credit_card_id === card.id)).toBe(true);
    expect(txns!.every((t) => t.purchased_on === '2026-08-08')).toBe(true);
    expect(txns!.every((t) => t.status === 'pending')).toBe(true);
  });

  it('I-CARD-BUY4 — cartão arquivado não aceita compra', async () => {
    const { supabase, card } = await createCard();
    const admin = getAdminClient();
    await admin.from('credit_cards').update({ is_archived: true }).eq('id', card.id);

    const result = await createCardPurchaseCore(
      { supabase, session: SEED_SESSION },
      {
        cardId: card.id,
        amountCents: 1000,
        description: 'CARD test arquivado',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        purchasedOn: '2026-08-08',
        installments: 1,
      },
    );
    expect(result.ok).toBe(false);
  });
});
