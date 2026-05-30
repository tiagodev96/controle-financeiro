import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadReservaAllocatedCents } from '@/lib/finance/reserva-data';
import type { RateMap } from '@/lib/fx';
import { getAuthedClient, SEED_SESSION, SEED_DEMO_HOUSEHOLD_ID } from './helpers/auth';
import { getAdminClient } from './helpers/db';

const NAME_PREFIX = 'RESA test';

const fxMap: RateMap = {
  EUR_BRL: 6,
  BRL_EUR: 1 / 6,
  rateDate: '2026-01-01',
  isStale: false,
};

let counter = 0;

async function seedEnvelope(input: {
  currentCents: number;
  currency: 'EUR' | 'BRL';
  isReserve: boolean;
}): Promise<void> {
  const admin = getAdminClient();
  counter += 1;
  const { error } = await admin.from('envelopes').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    name: `${NAME_PREFIX} ${counter}`,
    currency: input.currency,
    current_cents: input.currentCents,
    is_reserve: input.isReserve,
  });
  if (error) throw new Error(`seedEnvelope: ${error.message}`);
}

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await admin.from('envelopes').delete().like('name', `${NAME_PREFIX}%`);
}

describe('loadReservaAllocatedCents (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-RESA1 — sem caixinha de reserva → 0', async () => {
    await seedEnvelope({ currentCents: 100_000, currency: 'EUR', isReserve: false });

    const supabase = await getAuthedClient();
    const cents = await loadReservaAllocatedCents({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: null,
    });

    expect(cents).toBe(0);
  });

  it('I-RESA2 — caixinha de reserva na moeda alvo → current_cents', async () => {
    await seedEnvelope({ currentCents: 800_000, currency: 'EUR', isReserve: true });
    await seedEnvelope({ currentCents: 100_000, currency: 'EUR', isReserve: false });

    const supabase = await getAuthedClient();
    const cents = await loadReservaAllocatedCents({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: null,
    });

    expect(cents).toBe(800_000);
  });

  it('I-RESA3 — caixinha de reserva em outra moeda → convertida via fx', async () => {
    await seedEnvelope({ currentCents: 60_000, currency: 'BRL', isReserve: true });

    const supabase = await getAuthedClient();
    const cents = await loadReservaAllocatedCents({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: fxMap,
    });

    // R$ 600 * (1/6) = € 100.
    expect(cents).toBe(10_000);
  });
});
