import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateMonthStats } from '@/lib/finance/dashboard-stats';
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

describe('calculateMonthStats — corte de atraso no mês futuro (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });
  afterEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-STATS1 — parcela do mês futuro fica em pending, não em atraso', async () => {
    const now = new Date();
    const { targetDate, day5Iso } = nextMonthBounds(now);

    await insertPendingExpense('Parcela futura 1/3', day5Iso, 50000);

    const supabase = await getAuthedClient();
    const stats = await calculateMonthStats(
      supabase,
      SEED_DEMO_HOUSEHOLD_ID,
      'EUR',
      0,
      targetDate,
      now,
    );

    expect(stats.pending.totalCents).toBe(50000);
    expect(stats.pending.count).toBe(1);
    expect(stats.overdue.totalCents).toBe(0);
  });
});
