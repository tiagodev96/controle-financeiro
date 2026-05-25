import { describe, it, expect, beforeEach } from 'vitest';
import { markPaidCore } from '@/server/actions/transactions/mark-paid-core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import {
  truncateHouseholdTransactions,
  getAdminClient,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

const TODAY = new Date().toISOString().slice(0, 10);

async function seedPendingTxn(householdId = SEED_DEMO_HOUSEHOLD_ID): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('transactions')
    .insert({
      household_id: householdId,
      profile_id: SEED_TIAGO_SESSION.userId,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: SEED_CATEGORY_MERCADO_ID,
      direction: 'expense',
      amount_cents: 1250,
      currency: 'EUR',
      description: 'pendente seed',
      occurred_on: TODAY,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedPendingTxn: ${error?.message}`);
  return data.id;
}

describe('markPaidCore (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-M1 — pending válido → ok:true, status=paid, paid_on=hoje', async () => {
    const txnId = await seedPendingTxn();
    const supabase = await getAuthedClient();

    const result = await markPaidCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { transactionId: txnId },
    );

    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('transactions')
      .select('status, paid_on')
      .eq('id', txnId)
      .single();
    expect(data?.status).toBe('paid');
    expect(data?.paid_on).toBe(TODAY);
  });

  it('I-M2 — já pago retorna ok:false (não silencia)', async () => {
    const txnId = await seedPendingTxn();
    const supabase = await getAuthedClient();
    await markPaidCore({ supabase, session: SEED_TIAGO_SESSION }, { transactionId: txnId });

    const result = await markPaidCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { transactionId: txnId },
    );

    expect(result.ok).toBe(false);
  });

  it('I-M3 — txn de outro household → ok:false (RLS bloqueia)', async () => {
    const isolated = await createIsolatedHousehold();
    try {
      const admin = getAdminClient();
      const { data, error } = await admin
        .from('transactions')
        .insert({
          household_id: isolated.householdId,
          profile_id: SEED_TIAGO_SESSION.userId,
          account_id: SEED_ACCOUNT_EUR_ID,
          category_id: isolated.categoryId,
          direction: 'expense',
          amount_cents: 100,
          currency: 'EUR',
          description: 'foreign',
          occurred_on: TODAY,
          status: 'pending',
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`seed foreign: ${error?.message}`);

      const supabase = await getAuthedClient();
      const result = await markPaidCore(
        { supabase, session: SEED_TIAGO_SESSION },
        { transactionId: data.id },
      );

      expect(result.ok).toBe(false);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });

  it('I-M4 — txn inexistente → ok:false', async () => {
    const supabase = await getAuthedClient();
    const result = await markPaidCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { transactionId: '00000000-0000-4000-8000-000000000000' },
    );
    expect(result.ok).toBe(false);
  });
});
