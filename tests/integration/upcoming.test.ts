import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listUpcomingPending } from '@/lib/finance/upcoming';
import {
  getAuthedClient,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_USER_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function insertPending(description: string, daysAhead: number): Promise<void> {
  const admin = getAdminClient();
  await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: SEED_ACCOUNT_EUR_ID,
    category_id: SEED_CATEGORY_MERCADO_ID,
    direction: 'expense',
    amount_cents: 5000,
    currency: 'EUR',
    description,
    occurred_on: isoOffset(daysAhead),
    status: 'pending',
  });
}

describe('listUpcomingPending (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });
  afterEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-NEXT1 — retorna pending entre hoje e hoje+7, ordenado por occurred_on asc', async () => {
    await insertPending('UP futura mais perto', 2);
    await insertPending('UP futura mais longe', 6);
    await insertPending('UP fora da janela', 10);

    const supabase = await getAuthedClient();
    const rows = await listUpcomingPending(supabase, SEED_DEMO_HOUSEHOLD_ID, new Date(), 7);

    expect(rows.map((r) => r.description)).toEqual([
      'UP futura mais perto',
      'UP futura mais longe',
    ]);
  });

  it('I-NEXT2 — não inclui paid nem em atraso (occurred_on < hoje)', async () => {
    await insertPending('UP atraso', -2);
    await insertPending('UP futura', 3);

    const admin = getAdminClient();
    await admin.from('transactions').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_USER_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: SEED_CATEGORY_MERCADO_ID,
      direction: 'expense',
      amount_cents: 5000,
      currency: 'EUR',
      description: 'UP pago',
      occurred_on: isoOffset(3),
      paid_on: isoOffset(0),
      status: 'paid',
    });

    const supabase = await getAuthedClient();
    const rows = await listUpcomingPending(supabase, SEED_DEMO_HOUSEHOLD_ID, new Date(), 7);

    expect(rows.map((r) => r.description)).toEqual(['UP futura']);
  });
});
