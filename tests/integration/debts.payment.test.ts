import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDebtCore } from '@/server/actions/debts/core';
import { registerDebtPaymentCore } from '@/server/actions/debts/register-payment-core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

async function cleanupDebts(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('debts')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'DB pay test %');
}

async function cleanupDebtCategory(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('categories')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .eq('name', 'Dívidas');
}

const TODAY = new Date().toISOString().slice(0, 10);

describe('debts payments (integração + trigger DB)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await cleanupDebts();
    await cleanupDebtCategory();
  });
  afterEach(async () => {
    await cleanupDebts();
    await cleanupDebtCategory();
  });

  it('I-DB-PAYMENT — registrar pagamento parcial: cria transaction com source_debt_id e trigger atualiza remaining', async () => {
    const supabase = await getAuthedClient();
    const created = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB pay test parcial',
        originalAmountCents: 100_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const paid = await registerDebtPaymentCore(
      { supabase, session: SEED_SESSION },
      {
        debtId: created.debt.id,
        amountCents: 30_000,
        accountId: SEED_ACCOUNT_EUR_ID,
        date: TODAY,
        description: 'Pagamento parcial Jefferson',
      },
    );
    expect(paid.ok).toBe(true);

    const admin = getAdminClient();
    const { data: debt } = await admin
      .from('debts')
      .select('remaining_amount_cents, status')
      .eq('id', created.debt.id)
      .single();
    expect(debt?.remaining_amount_cents).toBe(70_000);
    expect(debt?.status).toBe('open');

    // Confirma que a transaction foi criada com source_debt_id
    const { data: txns } = await admin
      .from('transactions')
      .select('source_debt_id, amount_cents, direction, status, paid_on')
      .eq('source_debt_id', created.debt.id);
    expect(txns).toHaveLength(1);
    expect(txns?.[0]).toMatchObject({
      source_debt_id: created.debt.id,
      amount_cents: 30_000,
      direction: 'expense',
      status: 'paid',
      paid_on: TODAY,
    });
  });

  it('I-DB-PAYMENT-CATEGORY — pagamento categoriza a transaction em "Dívidas", criando a categoria se faltar', async () => {
    const supabase = await getAuthedClient();
    const created = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB pay test categoria',
        originalAmountCents: 100_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const paid = await registerDebtPaymentCore(
      { supabase, session: SEED_SESSION },
      {
        debtId: created.debt.id,
        amountCents: 30_000,
        accountId: SEED_ACCOUNT_EUR_ID,
        date: TODAY,
        description: 'Pagamento categorizado',
      },
    );
    expect(paid.ok).toBe(true);

    const admin = getAdminClient();
    const { data: category } = await admin
      .from('categories')
      .select('id, kind, sort_order')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .eq('name', 'Dívidas')
      .single();
    expect(category?.kind).toBe('expense');
    // sort_order alto pra categoria criada on-demand não furar a fila do picker
    expect(category?.sort_order).toBe(99);

    const { data: txns } = await admin
      .from('transactions')
      .select('category_id')
      .eq('source_debt_id', created.debt.id);
    expect(txns).toHaveLength(1);
    expect(txns?.[0]?.category_id).toBe(category?.id);
  });

  it('I-DB-PAYMENT-CATEGORY-KIND — categoria "Dívidas" de kind income não é reusada: pagamento fica sem categoria', async () => {
    const admin = getAdminClient();
    const { error: seedError } = await admin
      .from('categories')
      .insert({ household_id: SEED_DEMO_HOUSEHOLD_ID, name: 'Dívidas', kind: 'income' });
    if (seedError) throw new Error(`setup: ${seedError.message}`);

    const supabase = await getAuthedClient();
    const created = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB pay test categoria income',
        originalAmountCents: 100_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const paid = await registerDebtPaymentCore(
      { supabase, session: SEED_SESSION },
      {
        debtId: created.debt.id,
        amountCents: 30_000,
        accountId: SEED_ACCOUNT_EUR_ID,
        date: TODAY,
        description: 'Pagamento sem categoria',
      },
    );
    expect(paid.ok).toBe(true);

    const { data: txns } = await admin
      .from('transactions')
      .select('category_id')
      .eq('source_debt_id', created.debt.id);
    expect(txns).toHaveLength(1);
    expect(txns?.[0]?.category_id).toBeNull();

    // Não cria uma segunda "Dívidas" — o unique household+name impede
    const { data: categories } = await admin
      .from('categories')
      .select('kind')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .eq('name', 'Dívidas');
    expect(categories).toHaveLength(1);
    expect(categories?.[0]?.kind).toBe('income');
  });

  it('I-DB-CLOSE-TRIGGER — pagamento que zera remaining → status=closed automático', async () => {
    const supabase = await getAuthedClient();
    const created = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB pay test quita',
        originalAmountCents: 50_000,
        currency: 'EUR',
        priority: 3,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const paid = await registerDebtPaymentCore(
      { supabase, session: SEED_SESSION },
      {
        debtId: created.debt.id,
        amountCents: 50_000,
        accountId: SEED_ACCOUNT_EUR_ID,
        date: TODAY,
        description: 'Quitação',
      },
    );
    expect(paid.ok).toBe(true);

    const admin = getAdminClient();
    const { data: debt } = await admin
      .from('debts')
      .select('remaining_amount_cents, status, closed_at')
      .eq('id', created.debt.id)
      .single();
    expect(debt?.remaining_amount_cents).toBe(0);
    expect(debt?.status).toBe('closed');
    expect(debt?.closed_at).not.toBeNull();
  });
});
