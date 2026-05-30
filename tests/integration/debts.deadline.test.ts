import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDebtCore, updateDebtCore } from '@/server/actions/debts/core';
import { debtPaymentPace } from '@/lib/finance/debts';
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
    .like('title', 'DB deadline test %');
}

const now = new Date();
const monthDayIso = (monthsAgo: number): string =>
  new Date(now.getFullYear(), now.getMonth() - monthsAgo, 10).toISOString().slice(0, 10);

describe('debts deadline (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await cleanupDebts();
  });
  afterEach(cleanupDebts);

  it('I-DL-CREATE — persiste target_quit_date quando informado', async () => {
    const supabase = await getAuthedClient();
    const result = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB deadline test com meta',
        originalAmountCents: 300_000,
        currency: 'EUR',
        priority: 1,
        notes: null,
        targetQuitDate: '2026-12-31',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.debt.target_quit_date).toBe('2026-12-31');
  });

  it('I-DL-CREATE-NULL — sem meta persiste null', async () => {
    const supabase = await getAuthedClient();
    const result = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB deadline test sem meta',
        originalAmountCents: 100_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.debt.target_quit_date).toBeNull();
  });

  it('I-DL-UPDATE — seta e limpa a meta via patch', async () => {
    const supabase = await getAuthedClient();
    const created = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB deadline test update',
        originalAmountCents: 100_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const admin = getAdminClient();

    const set = await updateDebtCore(
      { supabase, session: SEED_SESSION },
      { debtId: created.debt.id, patch: { targetQuitDate: '2027-03-31' } },
    );
    expect(set.ok).toBe(true);
    const afterSet = await admin
      .from('debts')
      .select('target_quit_date')
      .eq('id', created.debt.id)
      .single();
    expect(afterSet.data?.target_quit_date).toBe('2027-03-31');

    const clear = await updateDebtCore(
      { supabase, session: SEED_SESSION },
      { debtId: created.debt.id, patch: { targetQuitDate: null } },
    );
    expect(clear.ok).toBe(true);
    const afterClear = await admin
      .from('debts')
      .select('target_quit_date')
      .eq('id', created.debt.id)
      .single();
    expect(afterClear.data?.target_quit_date).toBeNull();
  });

  it('I-DL-PACE-NONE — sem pagamentos retorna null', async () => {
    const supabase = await getAuthedClient();
    const debt = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB deadline test pace none',
        originalAmountCents: 300_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!debt.ok) throw new Error('setup');

    const pace = await debtPaymentPace(supabase, SEED_DEMO_HOUSEHOLD_ID, debt.debt.id, now);
    expect(pace).toBeNull();
  });

  it('I-DL-PACE — média sobre meses decorridos desde o 1º pagamento', async () => {
    const supabase = await getAuthedClient();
    const debt = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB deadline test pace',
        originalAmountCents: 300_000,
        currency: 'EUR',
        priority: 1,
        notes: null,
      },
    );
    if (!debt.ok) throw new Error('setup');

    const admin = getAdminClient();
    const payment = (paidOn: string, cents: number) => ({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_SESSION.userId,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: null,
      direction: 'expense' as const,
      amount_cents: cents,
      currency: 'EUR' as const,
      description: 'pace',
      occurred_on: paidOn,
      paid_on: paidOn,
      status: 'paid' as const,
      source_debt_id: debt.debt.id,
    });

    await admin.from('transactions').insert([
      payment(monthDayIso(2), 20_000),
      payment(monthDayIso(1), 20_000),
      payment(monthDayIso(0), 20_000),
    ]);

    const pace = await debtPaymentPace(supabase, SEED_DEMO_HOUSEHOLD_ID, debt.debt.id, now);
    expect(pace).not.toBeNull();
    expect(pace?.monthsElapsed).toBe(3);
    expect(pace?.paceCents).toBe(20_000);
  });
});
