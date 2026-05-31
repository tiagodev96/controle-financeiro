import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { projectMonthForFuture } from '@/lib/finance/month-projection';
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

describe('projectMonthForFuture — parcelas no mês alvo (integração)', () => {
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
    const projection = await projectMonthForFuture({
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
    const projection = await projectMonthForFuture({
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
});
