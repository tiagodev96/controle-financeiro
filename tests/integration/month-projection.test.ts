import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { projectMonth } from '@/lib/finance/month-projection';
import { listUngeneratedRecurringForMonth } from '@/lib/finance/recurring';
import {
  getAuthedClient,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_USER_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

function nextMonthBounds(now: Date): { targetDate: Date; day5Iso: string } {
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const targetDate = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const day5Iso = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-05`;
  return { targetDate, day5Iso };
}

async function clearRecurring(): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
  if (error) throw new Error(`clearRecurring failed: ${error.message}`);
}

async function insertPendingExpense(description: string, occurredOn: string, cents: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: SEED_ACCOUNT_EUR_ID,
    category_id: SEED_CATEGORY_MERCADO_ID,
    direction: 'expense',
    amount_cents: cents,
    currency: 'EUR',
    description,
    occurred_on: occurredOn,
    status: 'pending',
    installment_number: 1,
  });
  if (error) throw new Error(`insertPendingExpense failed: ${error.message}`);
}

describe('projectMonth — parcelas no mês alvo (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await clearRecurring();
  });
  afterEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await clearRecurring();
  });

  it('I-PROJ1 — parcela pendente no mês futuro é subtraída da sobra projetada', async () => {
    const now = new Date();
    const { targetDate, day5Iso } = nextMonthBounds(now);

    await insertPendingExpense('Parcela futura 1/3', day5Iso, 50000);

    const supabase = await getAuthedClient();
    const projection = await projectMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 100000,
      targetDate,
      now,
    });

    expect(projection.sobraProjetadaCents).toBe(50000);
  });

  it('I-PROJ2 — recorrente ativa + parcela ambas projetadas na despesa', async () => {
    const now = new Date();
    const { targetDate, day5Iso } = nextMonthBounds(now);

    await insertPendingExpense('Parcela futura 1/3', day5Iso, 50000);

    const admin = getAdminClient();
    const { error } = await admin.from('recurring_rules').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      title: 'Assinatura',
      amount_cents: 1500,
      currency: 'EUR',
      direction: 'expense',
      category_id: SEED_CATEGORY_MERCADO_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      day_of_month: 10,
    });
    if (error) throw new Error(`insert recurring failed: ${error.message}`);

    const supabase = await getAuthedClient();
    const projection = await projectMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 100000,
      targetDate,
      now,
    });

    expect(projection.stats.pendingExpenseCents).toBe(50000);
    expect(projection.recurringPendingExpenseCents).toBe(1500);
    expect(projection.sobraProjetadaCents).toBe(48500);
  });

  it('I-PROJ3 — soma do helper bate com recurringPendingExpenseCents da projeção (fonte única)', async () => {
    const now = new Date();
    const { targetDate } = nextMonthBounds(now);

    const admin = getAdminClient();
    const { error } = await admin.from('recurring_rules').insert([
      {
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        title: 'Adobe',
        amount_cents: 1498,
        currency: 'EUR',
        direction: 'expense',
        category_id: SEED_CATEGORY_MERCADO_ID,
        account_id: SEED_ACCOUNT_EUR_ID,
        day_of_month: 5,
      },
      {
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        title: 'Claude',
        amount_cents: 11000,
        currency: 'EUR',
        direction: 'expense',
        category_id: SEED_CATEGORY_MERCADO_ID,
        account_id: SEED_ACCOUNT_EUR_ID,
        day_of_month: 10,
      },
    ]);
    if (error) throw new Error(`insert recurring failed: ${error.message}`);

    const supabase = await getAuthedClient();
    const [occ, projection] = await Promise.all([
      listUngeneratedRecurringForMonth({ supabase, householdId: SEED_DEMO_HOUSEHOLD_ID, targetDate }),
      projectMonth({
        supabase,
        householdId: SEED_DEMO_HOUSEHOLD_ID,
        targetCurrency: 'EUR',
        fxRateMap: null,
        accountsTotalInTargetCents: 0,
        targetDate,
        now,
      }),
    ]);

    const helperExpenseSum = occ
      .filter((o) => o.direction === 'expense')
      .reduce((s, o) => s + o.amountCents, 0);
    expect(helperExpenseSum).toBe(12498);
    expect(projection.recurringPendingExpenseCents).toBe(helperExpenseSum);
  });

  it('I-PROJ4 — mês corrente: recorrente entra e paid não conta em dobro', async () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const iso = (day: number) =>
      `${y}-${String(m + 1).padStart(2, '0')}-${String(Math.min(day, 28)).padStart(2, '0')}`;
    const paidIso = iso(Math.max(1, now.getDate() - 1));
    const futureIso = iso(now.getDate() + 3);

    const admin = getAdminClient();
    // paid no mês (já refletido no saldo via param) — NÃO pode ser subtraído de novo
    await admin.from('transactions').insert([
      {
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        profile_id: SEED_USER_ID,
        account_id: SEED_ACCOUNT_EUR_ID,
        category_id: SEED_CATEGORY_MERCADO_ID,
        direction: 'expense',
        amount_cents: 20000,
        currency: 'EUR',
        description: 'Pago no mês',
        occurred_on: paidIso,
        paid_on: paidIso,
        status: 'paid',
      },
      {
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        profile_id: SEED_USER_ID,
        account_id: SEED_ACCOUNT_EUR_ID,
        category_id: SEED_CATEGORY_MERCADO_ID,
        direction: 'expense',
        amount_cents: 30000,
        currency: 'EUR',
        description: 'Pendente a vencer',
        occurred_on: futureIso,
        status: 'pending',
      },
      {
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        profile_id: SEED_USER_ID,
        account_id: SEED_ACCOUNT_EUR_ID,
        category_id: SEED_CATEGORY_MERCADO_ID,
        direction: 'income',
        amount_cents: 5000,
        currency: 'EUR',
        description: 'Entrada pendente',
        occurred_on: futureIso,
        status: 'pending',
      },
    ]);

    await admin.from('recurring_rules').insert([
      {
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        title: 'Salário',
        amount_cents: 220000,
        currency: 'EUR',
        direction: 'income',
        category_id: SEED_CATEGORY_MERCADO_ID,
        account_id: SEED_ACCOUNT_EUR_ID,
        day_of_month: 5,
      },
      {
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        title: 'Assinatura',
        amount_cents: 10000,
        currency: 'EUR',
        direction: 'expense',
        category_id: SEED_CATEGORY_MERCADO_ID,
        account_id: SEED_ACCOUNT_EUR_ID,
        day_of_month: 10,
      },
    ]);

    const supabase = await getAuthedClient();
    const projection = await projectMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 100000,
      targetDate: now,
      now,
    });

    // saldo 1000 + pendingIncome 50 + recorrente income 2200
    //   − pendingExpense 300 − recorrente expense 100 = 2850. Paid (200) NÃO entra.
    expect(projection.sobraProjetadaCents).toBe(285000);
  });
});
