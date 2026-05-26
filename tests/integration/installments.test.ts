import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInstallmentPlanCore,
  deleteInstallmentPlanCore,
} from '@/server/actions/installments/core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

async function cleanupPlans(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('installment_plans')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'PARC test %');
}

describe('installment_plans (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await cleanupPlans();
  });
  afterEach(cleanupPlans);

  it('I-PARC-CRUD1 — cria plano + N transactions com installment_number sequencial; soma == total', async () => {
    const supabase = await getAuthedClient();
    const result = await createInstallmentPlanCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        title: 'PARC test notebook',
        totalAmountCents: 40000,
        currency: 'EUR',
        totalInstallments: 4,
        firstDueDate: '2026-06-15',
        frequencyMonths: 1,
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        notes: null,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select('amount_cents, installment_number, status, source_installment_plan_id, occurred_on')
      .eq('source_installment_plan_id', result.plan.id)
      .order('installment_number', { ascending: true });

    expect(txns).toHaveLength(4);
    expect(txns?.map((t) => t.installment_number)).toEqual([1, 2, 3, 4]);
    expect(txns?.every((t) => t.status === 'pending')).toBe(true);
    expect((txns ?? []).reduce((s, t) => s + t.amount_cents, 0)).toBe(40000);
  });

  it('I-PARC-CRUD2 — arredondamento: total=10001 em 3 parcelas distribui 3334/3334/3333', async () => {
    const supabase = await getAuthedClient();
    const result = await createInstallmentPlanCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        title: 'PARC test roundoff',
        totalAmountCents: 10001,
        currency: 'EUR',
        totalInstallments: 3,
        firstDueDate: '2026-06-01',
        frequencyMonths: 1,
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        notes: null,
      },
    );
    if (!result.ok) throw new Error('setup');

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select('amount_cents')
      .eq('source_installment_plan_id', result.plan.id);

    const amounts = (txns ?? []).map((t) => t.amount_cents).sort((a, b) => a - b);
    expect(amounts.reduce((s, x) => s + x, 0)).toBe(10001);
    const min = amounts[0] ?? 0;
    const max = amounts[amounts.length - 1] ?? 0;
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it('I-PARC-FREQ — frequency_months=2 gera parcelas bimensais', async () => {
    const supabase = await getAuthedClient();
    const result = await createInstallmentPlanCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        title: 'PARC test bimensal',
        totalAmountCents: 9000,
        currency: 'EUR',
        totalInstallments: 3,
        firstDueDate: '2026-06-10',
        frequencyMonths: 2,
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        notes: null,
      },
    );
    if (!result.ok) throw new Error('setup');

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select('occurred_on, installment_number')
      .eq('source_installment_plan_id', result.plan.id)
      .order('installment_number', { ascending: true });

    expect(txns?.map((t) => t.occurred_on)).toEqual(['2026-06-10', '2026-08-10', '2026-10-10']);
  });

  it('I-PARC-CANCEL — deletar plano preserva transactions com source_installment_plan_id=null', async () => {
    const supabase = await getAuthedClient();
    const created = await createInstallmentPlanCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        title: 'PARC test cancel',
        totalAmountCents: 12000,
        currency: 'EUR',
        totalInstallments: 3,
        firstDueDate: '2026-06-01',
        frequencyMonths: 1,
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const deleted = await deleteInstallmentPlanCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { planId: created.plan.id },
    );
    expect(deleted.ok).toBe(true);

    const admin = getAdminClient();
    const { data: orphan } = await admin
      .from('transactions')
      .select('source_installment_plan_id')
      .is('source_installment_plan_id', null)
      .eq('description', 'PARC test cancel 1/3');
    expect(orphan?.length).toBeGreaterThan(0);
  });

  it('I-PARC-CURRENCY — plan.currency != account.currency rejeita', async () => {
    const supabase = await getAuthedClient();
    const result = await createInstallmentPlanCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        title: 'PARC test mismatch',
        totalAmountCents: 9000,
        currency: 'BRL',
        totalInstallments: 3,
        firstDueDate: '2026-06-01',
        frequencyMonths: 1,
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        notes: null,
      },
    );
    expect(result.ok).toBe(false);
  });
});

// Suppress unused warning on import — referenced by test setup for currency mismatch.
void SEED_ACCOUNT_BRL_ID;
