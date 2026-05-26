import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTransactionForSession } from '@/server/actions/transactions/create-core';
import { markPaidCore } from '@/server/actions/transactions/mark-paid-core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_TIAGO_USER_ID,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

const TODAY = new Date().toISOString().slice(0, 10);
const INITIAL_BALANCE = 100_000;

async function resetAccountBalance(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('accounts')
    .update({ balance_cents: INITIAL_BALANCE })
    .eq('id', SEED_ACCOUNT_EUR_ID);
}

async function readBalance(): Promise<number> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('accounts')
    .select('balance_cents')
    .eq('id', SEED_ACCOUNT_EUR_ID)
    .single();
  return data?.balance_cents ?? 0;
}

async function seedPending(amountCents = 1250): Promise<string> {
  const admin = getAdminClient();
  const { data } = await admin
    .from('transactions')
    .insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_TIAGO_USER_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: SEED_CATEGORY_MERCADO_ID,
      direction: 'expense',
      amount_cents: amountCents,
      currency: 'EUR',
      description: 'BAL test pending',
      occurred_on: TODAY,
      status: 'pending',
    })
    .select('id')
    .single();
  return data!.id;
}

describe('balance update on paid transactions (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await resetAccountBalance();
  });
  afterEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await resetAccountBalance();
  });

  it('I-BAL1 — criar despesa paga com updateBalance=true desconta do saldo', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        amountCents: 2500,
        description: 'BAL test 1',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        direction: 'expense',
        paid: true,
        updateBalance: true,
        date: TODAY,
      },
    );
    expect(result.ok).toBe(true);
    expect(await readBalance()).toBe(INITIAL_BALANCE - 2500);
  });

  it('I-BAL2 — criar despesa paga com updateBalance=false preserva saldo', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        amountCents: 2500,
        description: 'BAL test 2',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        direction: 'expense',
        paid: true,
        updateBalance: false,
        date: TODAY,
      },
    );
    expect(result.ok).toBe(true);
    expect(await readBalance()).toBe(INITIAL_BALANCE);
  });

  it('I-BAL3 — pending ignora updateBalance e preserva saldo', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        amountCents: 2500,
        description: 'BAL test 3',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        direction: 'expense',
        paid: false,
        updateBalance: true,
        date: TODAY,
      },
    );
    expect(result.ok).toBe(true);
    expect(await readBalance()).toBe(INITIAL_BALANCE);
  });

  it('I-BAL4 — criar entrada já recebida com updateBalance=true soma no saldo', async () => {
    const supabase = await getAuthedClient();
    const result = await createTransactionForSession(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        amountCents: 5000,
        description: 'BAL test 4',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        direction: 'income',
        paid: true,
        updateBalance: true,
        date: TODAY,
      },
    );
    expect(result.ok).toBe(true);
    expect(await readBalance()).toBe(INITIAL_BALANCE + 5000);
  });

  it('I-BAL5 — markPaidCore com updateBalance=true ajusta o saldo', async () => {
    const txnId = await seedPending(3000);
    const supabase = await getAuthedClient();
    const result = await markPaidCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { transactionId: txnId, updateBalance: true },
    );
    expect(result.ok).toBe(true);
    expect(await readBalance()).toBe(INITIAL_BALANCE - 3000);
  });

  it('I-BAL6 — markPaidCore com updateBalance=false preserva saldo', async () => {
    const txnId = await seedPending(3000);
    const supabase = await getAuthedClient();
    const result = await markPaidCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { transactionId: txnId, updateBalance: false },
    );
    expect(result.ok).toBe(true);
    expect(await readBalance()).toBe(INITIAL_BALANCE);
  });
});
