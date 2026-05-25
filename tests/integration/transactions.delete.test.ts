import { describe, it, expect, beforeEach } from 'vitest';
import { deleteTransactionCore } from '@/server/actions/transactions/delete-core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import {
  getAdminClient,
  truncateHouseholdTransactions,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

const TODAY = new Date().toISOString().slice(0, 10);

async function seedTxn(householdId: string, categoryId: string): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('transactions')
    .insert({
      household_id: householdId,
      profile_id: SEED_TIAGO_SESSION.userId,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: categoryId,
      direction: 'expense',
      amount_cents: 500,
      currency: 'EUR',
      description: 'seed delete',
      occurred_on: TODAY,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedTxn: ${error?.message}`);
  return data.id;
}

describe('deleteTransactionCore (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-DEL1 — delete válido → row sumiu', async () => {
    const txnId = await seedTxn(SEED_DEMO_HOUSEHOLD_ID, SEED_CATEGORY_MERCADO_ID);
    const supabase = await getAuthedClient();
    const result = await deleteTransactionCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { id: txnId },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('transactions')
      .select('id')
      .eq('id', txnId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it('I-DEL2 — delete de outro household → ok:false e row intacta', async () => {
    const isolated = await createIsolatedHousehold();
    try {
      const txnId = await seedTxn(isolated.householdId, isolated.categoryId);
      const supabase = await getAuthedClient();
      const result = await deleteTransactionCore(
        { supabase, session: SEED_TIAGO_SESSION },
        { id: txnId },
      );
      expect(result.ok).toBe(false);

      const admin = getAdminClient();
      const { data } = await admin
        .from('transactions')
        .select('id')
        .eq('id', txnId)
        .maybeSingle();
      expect(data?.id).toBe(txnId);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });
});
