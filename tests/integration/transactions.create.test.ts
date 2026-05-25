import { describe, it, expect, beforeEach } from 'vitest';
import { createTransactionForSession } from '@/server/actions/transactions/create-core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import {
  truncateHouseholdTransactions,
  getAdminClient,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

// Data dinâmica: o schema rejeita data > 1 ano à frente via Date.now(), então
// uma constante fixa quebraria o teste em ~1 ano.
const TODAY = new Date().toISOString().slice(0, 10);

const baseInput = {
  amountCents: 1250,
  description: 'Pão na padaria',
  categoryId: SEED_CATEGORY_MERCADO_ID,
  accountId: SEED_ACCOUNT_EUR_ID,
  paid: false,
  date: TODAY,
} as const;

describe('createTransactionForSession (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I1 — cria transaction pending com dados válidos', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      baseInput
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.transaction).toMatchObject({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_TIAGO_SESSION.userId,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: SEED_CATEGORY_MERCADO_ID,
      amount_cents: 1250,
      currency: 'EUR',
      direction: 'expense',
      status: 'pending',
      paid_on: null,
      description: 'Pão na padaria',
      occurred_on: TODAY,
    });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('transactions')
      .select('id, household_id')
      .eq('id', result.transaction.id)
      .single();
    expect(error).toBeNull();
    expect(data?.household_id).toBe(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I3 — currency vem da conta selecionada (BRL), não do input', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      { ...baseInput, accountId: SEED_ACCOUNT_BRL_ID }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.currency).toBe('BRL');
  });

  it('I6 — amountCents = 0 retorna erro e não insere nada', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      { ...baseInput, amountCents: 0 }
    );

    expect(result.ok).toBe(false);

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
    expect(count).toBe(0);
  });

  it('I2 — paid:true grava status="paid" e paid_on=date', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      { ...baseInput, paid: true }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction.status).toBe('paid');
    expect(result.transaction.paid_on).toBe(TODAY);
  });

  it('I5 — RLS impede usar categoryId de outro household', async () => {
    const isolated = await createIsolatedHousehold();
    try {
      const supabase = await getAuthedClient();
      const result = await createTransactionForSession(
        { supabase, session: SEED_TIAGO_SESSION },
        { ...baseInput, categoryId: isolated.categoryId }
      );

      expect(result.ok).toBe(false);

      const admin = getAdminClient();
      const { count } = await admin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
      expect(count).toBe(0);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });

  it('I7 — amountCents negativo retorna erro e não insere nada', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      { ...baseInput, amountCents: -500 }
    );

    expect(result.ok).toBe(false);

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
    expect(count).toBe(0);
  });

  it('I8 — descrição vazia retorna erro e não insere nada', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      { ...baseInput, description: '   ' }
    );

    expect(result.ok).toBe(false);

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
    expect(count).toBe(0);
  });

  it('I9 — categoryId UUID válido mas inexistente retorna erro', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      { ...baseInput, categoryId: '99999999-9999-4999-8999-999999999999' }
    );

    expect(result.ok).toBe(false);

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
    expect(count).toBe(0);
  });

  it('I-IN1 — cria transaction com direction=income e status default pending', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        amountCents: 250000,
        description: 'Salário maio',
        // Categoria income do seed
        categoryId: '33333333-3333-4333-8333-333333333101',
        accountId: SEED_ACCOUNT_EUR_ID,
        direction: 'income',
        paid: false,
        date: TODAY,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction).toMatchObject({
      direction: 'income',
      amount_cents: 250000,
      status: 'pending',
      paid_on: null,
    });
  });
});
