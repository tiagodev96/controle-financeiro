import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getBalanceOn, getBalanceByAccountOn } from '@/lib/finance/balance-history';
import { listSnapshotsForChart } from '@/lib/finance/balance-trend';
import { toLocalIsoDate } from '@/lib/dates';
import {
  getAuthedClient,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalIsoDate(d);
}

async function seedSnapshot(accountId: string, date: string, cents: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('account_balance_snapshots').upsert(
    {
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      account_id: accountId,
      snapshot_date: date,
      balance_cents: cents,
      source: 'auto',
    },
    { onConflict: 'account_id,snapshot_date' },
  );
  if (error) throw new Error(`seedSnapshot: ${error.message}`);
}

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('account_balance_snapshots')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
  if (error) throw new Error(`cleanup snapshots: ${error.message}`);
}

describe('balance-history + balance-trend (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-BH1 — usa o snapshot mais recente <= data pedida', async () => {
    await seedSnapshot(SEED_ACCOUNT_EUR_ID, daysAgoIso(20), 80_000);
    await seedSnapshot(SEED_ACCOUNT_EUR_ID, daysAgoIso(10), 90_000);

    const supabase = await getAuthedClient();
    const lookup = await getBalanceOn(
      supabase,
      SEED_ACCOUNT_EUR_ID,
      new Date(Date.now() - 5 * 86_400_000),
      12_345,
    );

    expect(lookup.source).toBe('snapshot');
    expect(lookup.cents).toBe(90_000);
    expect(lookup.snapshotDate).toBe(daysAgoIso(10));
  });

  it('I-BH2 — sem snapshot cai no saldo vivo (fallback)', async () => {
    const supabase = await getAuthedClient();
    const lookup = await getBalanceOn(supabase, SEED_ACCOUNT_EUR_ID, new Date(), 12_345);
    expect(lookup).toEqual({ cents: 12_345, source: 'live' });
  });

  it('I-BH3 — batch resolve cada conta independente', async () => {
    await seedSnapshot(SEED_ACCOUNT_EUR_ID, daysAgoIso(7), 70_000);

    const supabase = await getAuthedClient();
    const byAccount = await getBalanceByAccountOn(
      supabase,
      [
        { id: SEED_ACCOUNT_EUR_ID, balance_cents: 1 },
        { id: SEED_ACCOUNT_BRL_ID, balance_cents: 2 },
      ],
      new Date(),
    );

    expect(byAccount[SEED_ACCOUNT_EUR_ID]?.source).toBe('snapshot');
    expect(byAccount[SEED_ACCOUNT_EUR_ID]?.cents).toBe(70_000);
    expect(byAccount[SEED_ACCOUNT_BRL_ID]).toEqual({ cents: 2, source: 'live' });
  });

  it('I-BT1 — chart agrega snapshots por data filtrando a currency', async () => {
    const day = daysAgoIso(3);
    await seedSnapshot(SEED_ACCOUNT_EUR_ID, day, 50_000);
    await seedSnapshot(SEED_ACCOUNT_BRL_ID, day, 999_999); // BRL fica fora do chart EUR

    const supabase = await getAuthedClient();
    const points = await listSnapshotsForChart(supabase, SEED_DEMO_HOUSEHOLD_ID, 'EUR');

    expect(points).toEqual([{ date: day, totalCents: 50_000, accountsCount: 1 }]);
  });
});
