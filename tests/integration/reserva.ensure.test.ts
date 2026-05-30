import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ensureReserveEnvelopes,
  loadReserveEnvelopes,
  RESERVE_ENVELOPE_NAMES,
} from '@/lib/finance/reserva-envelopes';
import { getAuthedClient, SEED_SESSION, SEED_DEMO_HOUSEHOLD_ID } from './helpers/auth';
import { getAdminClient } from './helpers/db';

const RESERVE_NAMES = Object.values(RESERVE_ENVELOPE_NAMES);

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('envelopes')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .in('name', [...RESERVE_NAMES, 'RESENS adopt']);
}

describe('ensureReserveEnvelopes (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-RESENS1 — sem reserva: cria as 2 subcontas (R$ e €) zeradas e marcadas', async () => {
    const supabase = await getAuthedClient();

    const reserves = await ensureReserveEnvelopes(supabase, SEED_SESSION.householdId);

    expect(reserves).toHaveLength(2);
    const byCcy = Object.fromEntries(reserves.map((r) => [r.currency, r]));
    expect(byCcy.BRL?.name).toBe(RESERVE_ENVELOPE_NAMES.BRL);
    expect(byCcy.EUR?.name).toBe(RESERVE_ENVELOPE_NAMES.EUR);
    expect(reserves.every((r) => r.currentCents === 0)).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('envelopes')
      .select('currency, is_reserve')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .in('name', RESERVE_NAMES);
    expect((data ?? []).every((e) => e.is_reserve)).toBe(true);
    expect(data ?? []).toHaveLength(2);
  });

  it('I-RESENS2 — idempotente: chamar duas vezes não duplica', async () => {
    const supabase = await getAuthedClient();

    await ensureReserveEnvelopes(supabase, SEED_SESSION.householdId);
    const second = await ensureReserveEnvelopes(supabase, SEED_SESSION.householdId);

    expect(second).toHaveLength(2);

    const admin = getAdminClient();
    const { data } = await admin
      .from('envelopes')
      .select('id')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .in('name', RESERVE_NAMES);
    expect(data ?? []).toHaveLength(2);
  });

  it('I-RESENS3 — adota envelope existente com o nome exato (marca is_reserve, não duplica)', async () => {
    const admin = getAdminClient();
    const { data: existing } = await admin
      .from('envelopes')
      .insert({
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        name: RESERVE_ENVELOPE_NAMES.EUR,
        currency: 'EUR',
        current_cents: 50_000,
        is_reserve: false,
      })
      .select('id')
      .single();

    const supabase = await getAuthedClient();
    await ensureReserveEnvelopes(supabase, SEED_SESSION.householdId);

    const { data: eur } = await admin
      .from('envelopes')
      .select('id, current_cents, is_reserve')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .eq('name', RESERVE_ENVELOPE_NAMES.EUR);
    expect(eur ?? []).toHaveLength(1);
    expect(eur?.[0]?.id).toBe(existing?.id);
    expect(eur?.[0]?.is_reserve).toBe(true);
    expect(eur?.[0]?.current_cents).toBe(50_000);
  });

  it('I-RESENS4 — loadReserveEnvelopes devolve só as marcadas como reserva', async () => {
    const admin = getAdminClient();
    await admin.from('envelopes').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      name: 'RESENS adopt',
      currency: 'EUR',
      current_cents: 999,
      is_reserve: false,
    });
    const supabase = await getAuthedClient();
    await ensureReserveEnvelopes(supabase, SEED_SESSION.householdId);

    const reserves = await loadReserveEnvelopes(supabase, SEED_SESSION.householdId);
    expect(reserves).toHaveLength(2);
    expect(reserves.some((r) => r.name === 'RESENS adopt')).toBe(false);
  });
});
