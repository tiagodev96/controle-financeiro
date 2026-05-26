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

const TODAY = new Date().toISOString().slice(0, 10);

describe('debts payments (integração + trigger DB)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await cleanupDebts();
  });
  afterEach(cleanupDebts);

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
