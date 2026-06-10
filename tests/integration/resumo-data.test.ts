import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadResumoData } from '@/lib/finance/resumo-data';
import { toIsoDate, toLocalIsoDate } from '@/lib/dates';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_USER_ID,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import {
  getAdminClient,
  truncateHouseholdTransactions,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

const NOW = new Date();
const TODAY_LOCAL = toLocalIsoDate(NOW);

async function setBalance(accountId: string, cents: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('accounts')
    .update({ balance_cents: cents })
    .eq('id', accountId);
  if (error) throw new Error(`setBalance: ${error.message}`);
}

async function seedRateForToday(eurBrl: number): Promise<void> {
  const admin = getAdminClient();
  // getRate cacheia por dia UTC (toIsoDate).
  const { error } = await admin.from('fx_rates_cache').upsert(
    { rate_date: toIsoDate(NOW), base: 'EUR', quote: 'BRL', rate: eurBrl },
    { onConflict: 'rate_date,base,quote' },
  );
  if (error) throw new Error(`seedRateForToday: ${error.message}`);
}

async function seedExpense(
  amountCents: number,
  currency: 'EUR' | 'BRL',
  occurredOn: string = TODAY_LOCAL,
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: currency === 'EUR' ? SEED_ACCOUNT_EUR_ID : SEED_ACCOUNT_BRL_ID,
    category_id: SEED_CATEGORY_MERCADO_ID,
    direction: 'expense',
    amount_cents: amountCents,
    currency,
    description: 'RD test txn',
    occurred_on: occurredOn,
    paid_on: occurredOn,
    status: 'paid',
  });
  if (error) throw new Error(`seedExpense: ${error.message}`);
}

function prevMonthDay15(): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 15);
  return toLocalIsoDate(d);
}

async function seedDebt(input: {
  title: string;
  remainingCents: number;
  status: 'open' | 'closed';
  closedAt?: string | null;
}): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('debts').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    title: input.title,
    original_amount_cents: 100_000,
    remaining_amount_cents: input.remainingCents,
    currency: 'EUR',
    priority: 2,
    status: input.status,
    closed_at: input.closedAt ?? null,
  });
  if (error) throw new Error(`seedDebt: ${error.message}`);
}

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  await admin
    .from('debts')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'RD test %');
  await setBalance(SEED_ACCOUNT_EUR_ID, 0);
  await setBalance(SEED_ACCOUNT_BRL_ID, 0);
}

describe('loadResumoData (integração)', () => {
  beforeEach(async () => {
    await cleanup();
    await seedRateForToday(6);
  });
  afterEach(cleanup);

  it('I-RD1 — soma contas cross-currency em EUR e agrega stats do mês', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 100_000);
    await setBalance(SEED_ACCOUNT_BRL_ID, 60_000); // R$ 600 → € 100
    await seedExpense(5_000, 'EUR');

    const supabase = await getAuthedClient();
    const data = await loadResumoData({
      supabase,
      householdId: SEED_SESSION.householdId,
      currency: 'EUR',
      targetDate: NOW,
      now: NOW,
      isFuture: false,
      topCategoriesLimit: 3,
    });

    expect(data.accounts).toHaveLength(2);
    expect(data.accountsTotal.cents).toBe(110_000);
    expect(data.accountsTotal.fxIncomplete).toBe(false);
    expect(data.stats.paidExpenseCents).toBe(5_000);
    expect(data.stats.topCategories[0]?.name).toBe('Mercado');
    expect(data.projection).toBeNull();
    expect(data.hasData).toBe(true);
  });

  it('I-RD2 — dívidas abertas + quitadas no mês entram em debtsToShow com flag', async () => {
    await seedDebt({ title: 'RD test aberta', remainingCents: 50_000, status: 'open' });
    await seedDebt({
      title: 'RD test quitada agora',
      remainingCents: 0,
      status: 'closed',
      closedAt: NOW.toISOString(),
    });
    await seedDebt({
      title: 'RD test quitada antiga',
      remainingCents: 0,
      status: 'closed',
      closedAt: new Date(NOW.getFullYear(), NOW.getMonth() - 2, 15).toISOString(),
    });

    const supabase = await getAuthedClient();
    const data = await loadResumoData({
      supabase,
      householdId: SEED_SESSION.householdId,
      currency: 'EUR',
      targetDate: NOW,
      now: NOW,
      isFuture: false,
      topCategoriesLimit: 3,
    });

    expect(data.openDebts).toHaveLength(1);
    expect(data.closedDebtsThisMonth).toHaveLength(1);
    expect(data.debtsToShow.map((d) => ({ title: d.debt.title, isClosed: d.isClosed }))).toEqual([
      { title: 'RD test aberta', isClosed: false },
      { title: 'RD test quitada agora', isClosed: true },
    ]);
  });

  it('I-RD3 — mês futuro calcula projection', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 100_000);
    const future = new Date(NOW.getFullYear(), NOW.getMonth() + 2, 0);

    const supabase = await getAuthedClient();
    const data = await loadResumoData({
      supabase,
      householdId: SEED_SESSION.householdId,
      currency: 'EUR',
      targetDate: future,
      now: NOW,
      isFuture: true,
      topCategoriesLimit: 3,
    });

    expect(data.projection).not.toBeNull();
    expect(typeof data.projection?.sobraProjetadaCents).toBe('number');
  });

  it('I-RD5 — previousStats traz o fluxo do mês anterior; mês futuro não compara', async () => {
    await seedExpense(5_000, 'EUR');
    await seedExpense(12_000, 'EUR', prevMonthDay15());

    const supabase = await getAuthedClient();
    const data = await loadResumoData({
      supabase,
      householdId: SEED_SESSION.householdId,
      currency: 'EUR',
      targetDate: NOW,
      now: NOW,
      isFuture: false,
      topCategoriesLimit: 3,
    });

    expect(data.stats.paidExpenseCents).toBe(5_000);
    expect(data.previousStats?.paidExpenseCents).toBe(12_000);

    const future = new Date(NOW.getFullYear(), NOW.getMonth() + 2, 0);
    const futureData = await loadResumoData({
      supabase,
      householdId: SEED_SESSION.householdId,
      currency: 'EUR',
      targetDate: future,
      now: NOW,
      isFuture: true,
      topCategoriesLimit: 3,
    });
    expect(futureData.previousStats).toBeNull();
  });

  it('I-RD4 — household sem nada → hasData false (RLS isola)', async () => {
    const isolated = await createIsolatedHousehold();
    try {
      const supabase = await getAuthedClient();
      const data = await loadResumoData({
        supabase,
        householdId: isolated.householdId,
        currency: 'EUR',
        targetDate: NOW,
        now: NOW,
        isFuture: false,
        topCategoriesLimit: 3,
      });
      expect(data.accounts).toHaveLength(0);
      expect(data.debtsToShow).toHaveLength(0);
      expect(data.hasData).toBe(false);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });
});
