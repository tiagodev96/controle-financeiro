import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCreditCardCore } from '@/server/actions/credit-cards/core';
import { createCardPurchaseCore } from '@/server/actions/credit-cards/purchase-core';
import { payCardInvoiceCore } from '@/server/actions/credit-cards/pay-invoice-core';
import {
  listCreditCardsForHousehold,
  listInvoicesForCard,
  listPurchasesForInvoice,
} from '@/lib/finance/credit-cards';
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
    .from('credit_cards')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('name', 'CARD test %');
  await admin
    .from('accounts')
    .update({ balance_cents: 0 })
    .eq('id', SEED_ACCOUNT_BRL_ID);
}

async function setupCardWithTwoInvoices() {
  const supabase = await getAuthedClient();
  const created = await createCreditCardCore(
    { supabase, session: SEED_SESSION },
    {
      name: 'CARD test fatura',
      closingDay: 7,
      dueDay: 11,
      creditLimitCents: null,
      paymentAccountId: SEED_ACCOUNT_BRL_ID,
    },
  );
  if (!created.ok) throw new Error(`setup: ${created.error}`);
  const card = created.card;

  // Fatura de agosto (compras até 07/08) e fatura de setembro (compras de 08/08 em diante).
  const buys = [
    { amountCents: 10000, purchasedOn: '2026-08-05', description: 'CARD test ago 1' },
    { amountCents: 2500, purchasedOn: '2026-08-07', description: 'CARD test ago 2' },
    { amountCents: 7000, purchasedOn: '2026-08-08', description: 'CARD test set 1' },
  ];
  for (const buy of buys) {
    const result = await createCardPurchaseCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, categoryId: SEED_CATEGORY_MERCADO_ID, installments: 1, ...buy },
    );
    if (!result.ok) throw new Error(`setup compra: ${result.error}`);
  }
  return { supabase, card };
}

describe('fatura do cartão (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-CARD-INV1 — agrupa compras por vencimento com estado derivado', async () => {
    const { supabase, card } = await setupCardWithTwoInvoices();

    const invoices = await listInvoicesForCard(supabase, {
      cardId: card.id,
      closingDay: 7,
      dueDay: 11,
      todayIso: '2026-08-16',
    });

    expect(invoices).toHaveLength(2);
    const [aug, sep] = invoices;
    expect(aug!.dueOn).toBe('2026-08-11');
    expect(aug!.totalCents).toBe(12500);
    expect(aug!.count).toBe(2);
    expect(aug!.state).toBe('closed');
    expect(sep!.dueOn).toBe('2026-09-11');
    expect(sep!.totalCents).toBe(7000);
    expect(sep!.state).toBe('open');
  });

  it('I-CARD-INV1b — lista cartões do household e compras de uma fatura (mais recente primeiro)', async () => {
    const { supabase, card } = await setupCardWithTwoInvoices();

    const cards = await listCreditCardsForHousehold(supabase, SEED_DEMO_HOUSEHOLD_ID);
    expect(cards.some((c) => c.id === card.id)).toBe(true);

    const purchases = await listPurchasesForInvoice(supabase, {
      cardId: card.id,
      dueOn: '2026-08-11',
    });
    expect(purchases).toHaveLength(2);
    expect(purchases.map((p) => p.purchased_on)).toEqual(['2026-08-07', '2026-08-05']);
    expect(purchases.every((p) => p.status === 'pending')).toBe(true);
  });

  it('I-CARD-INV2 — pagar fatura marca só o ciclo alvo e debita a conta uma vez', async () => {
    const { supabase, card } = await setupCardWithTwoInvoices();
    const admin = getAdminClient();
    await admin
      .from('accounts')
      .update({ balance_cents: 100000 })
      .eq('id', SEED_ACCOUNT_BRL_ID);

    const result = await payCardInvoiceCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, dueDate: '2026-08-11', paidOn: '2026-08-11', updateBalance: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalPaidCents).toBe(12500);

    const { data: account } = await admin
      .from('accounts')
      .select('balance_cents')
      .eq('id', SEED_ACCOUNT_BRL_ID)
      .single();
    expect(account?.balance_cents).toBe(100000 - 12500);

    const { data: txns } = await admin
      .from('transactions')
      .select('occurred_on, status, paid_on')
      .eq('credit_card_id', card.id)
      .order('occurred_on', { ascending: true });
    const aug = txns!.filter((t) => t.occurred_on === '2026-08-11');
    const sep = txns!.filter((t) => t.occurred_on === '2026-09-11');
    expect(aug.every((t) => t.status === 'paid' && t.paid_on === '2026-08-11')).toBe(true);
    expect(sep.every((t) => t.status === 'pending')).toBe(true);
  });

  it('I-CARD-INV3 — pagar de novo é idempotente: retorna 0 e não debita', async () => {
    const { supabase, card } = await setupCardWithTwoInvoices();
    const admin = getAdminClient();
    await admin
      .from('accounts')
      .update({ balance_cents: 100000 })
      .eq('id', SEED_ACCOUNT_BRL_ID);

    const first = await payCardInvoiceCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, dueDate: '2026-08-11', paidOn: '2026-08-11', updateBalance: true },
    );
    expect(first.ok).toBe(true);

    const second = await payCardInvoiceCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, dueDate: '2026-08-11', paidOn: '2026-08-12', updateBalance: true },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.totalPaidCents).toBe(0);

    const { data: account } = await admin
      .from('accounts')
      .select('balance_cents')
      .eq('id', SEED_ACCOUNT_BRL_ID)
      .single();
    expect(account?.balance_cents).toBe(100000 - 12500);
  });

  it('I-CARD-INV4 — updateBalance=false marca pago sem mexer no saldo', async () => {
    const { supabase, card } = await setupCardWithTwoInvoices();
    const admin = getAdminClient();
    await admin
      .from('accounts')
      .update({ balance_cents: 50000 })
      .eq('id', SEED_ACCOUNT_BRL_ID);

    const result = await payCardInvoiceCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, dueDate: '2026-08-11', paidOn: '2026-08-11', updateBalance: false },
    );
    expect(result.ok).toBe(true);

    const { data: account } = await admin
      .from('accounts')
      .select('balance_cents')
      .eq('id', SEED_ACCOUNT_BRL_ID)
      .single();
    expect(account?.balance_cents).toBe(50000);
  });

  it('I-CARD-INV5 — fatura totalmente paga aparece com estado paid', async () => {
    const { supabase, card } = await setupCardWithTwoInvoices();
    await payCardInvoiceCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, dueDate: '2026-08-11', paidOn: '2026-08-11', updateBalance: false },
    );

    const invoices = await listInvoicesForCard(supabase, {
      cardId: card.id,
      closingDay: 7,
      dueDay: 11,
      todayIso: '2026-08-16',
    });
    const aug = invoices.find((i) => i.dueOn === '2026-08-11');
    expect(aug?.state).toBe('paid');
    expect(aug?.paidCents).toBe(12500);
    expect(aug?.pendingCents).toBe(0);
  });
});
