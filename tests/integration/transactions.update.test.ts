import { describe, it, expect, beforeEach } from 'vitest';
import { updateTransactionCore } from '@/server/actions/transactions/update-core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
  SEED_CATEGORY_RESTAURANTE_ID,
} from './helpers/auth';
import {
  getAdminClient,
  truncateHouseholdTransactions,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

const TODAY = new Date().toISOString().slice(0, 10);

async function seedTxn(overrides: Partial<{ amount_cents: number; status: 'pending' | 'paid' }> = {}): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('transactions')
    .insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_TIAGO_SESSION.userId,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: SEED_CATEGORY_MERCADO_ID,
      direction: 'expense',
      amount_cents: 1250,
      currency: 'EUR',
      description: 'seed',
      occurred_on: TODAY,
      status: 'pending',
      ...overrides,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedTxn: ${error?.message}`);
  return data.id;
}

describe('updateTransactionCore (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-UP1 — patch só amount_cents preserva os outros campos', async () => {
    const txnId = await seedTxn();
    const supabase = await getAuthedClient();
    const result = await updateTransactionCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { id: txnId, patch: { amountCents: 1500 } },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('transactions')
      .select('amount_cents, description, category_id, account_id, currency, occurred_on, status')
      .eq('id', txnId)
      .single();
    expect(data?.amount_cents).toBe(1500);
    expect(data?.description).toBe('seed');
    expect(data?.category_id).toBe(SEED_CATEGORY_MERCADO_ID);
    expect(data?.account_id).toBe(SEED_ACCOUNT_EUR_ID);
    expect(data?.currency).toBe('EUR');
    expect(data?.status).toBe('pending');
  });

  it('I-UP2 — patch accountId muda currency pra moeda da nova conta', async () => {
    const txnId = await seedTxn();
    const supabase = await getAuthedClient();
    const result = await updateTransactionCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { id: txnId, patch: { accountId: SEED_ACCOUNT_BRL_ID } },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('transactions')
      .select('account_id, currency')
      .eq('id', txnId)
      .single();
    expect(data?.account_id).toBe(SEED_ACCOUNT_BRL_ID);
    expect(data?.currency).toBe('BRL');
  });

  it('I-UP3 — patch paid:true (era pending) → status=paid + paid_on=date', async () => {
    const txnId = await seedTxn({ status: 'pending' });
    const supabase = await getAuthedClient();
    const result = await updateTransactionCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { id: txnId, patch: { paid: true } },
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

  it('I-UP4 — patch categoryId de outro household → ok:false', async () => {
    const txnId = await seedTxn();
    const isolated = await createIsolatedHousehold();
    try {
      const supabase = await getAuthedClient();
      const result = await updateTransactionCore(
        { supabase, session: SEED_TIAGO_SESSION },
        { id: txnId, patch: { categoryId: isolated.categoryId } },
      );
      expect(result.ok).toBe(false);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });

  it('I-UP1b — patch categoryId/description simultâneo aplica ambos', async () => {
    const txnId = await seedTxn();
    const supabase = await getAuthedClient();
    const result = await updateTransactionCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        id: txnId,
        patch: { categoryId: SEED_CATEGORY_RESTAURANTE_ID, description: 'novo desc' },
      },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('transactions')
      .select('category_id, description')
      .eq('id', txnId)
      .single();
    expect(data?.category_id).toBe(SEED_CATEGORY_RESTAURANTE_ID);
    expect(data?.description).toBe('novo desc');
  });
});
