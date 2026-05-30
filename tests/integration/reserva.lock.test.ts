import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  updateEnvelopeCore,
  deleteEnvelopeCore,
  allocateToEnvelopeCore,
} from '@/server/actions/envelopes/core';
import {
  ensureReserveEnvelopes,
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
    .in('name', RESERVE_NAMES);
}

async function reserveEur(): Promise<string> {
  const supabase = await getAuthedClient();
  const reserves = await ensureReserveEnvelopes(supabase, SEED_SESSION.householdId);
  const eur = reserves.find((r) => r.currency === 'EUR');
  if (!eur) throw new Error('reserveEur: subconta € não criada');
  return eur.id;
}

describe('reserva lock (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-RESLOCK1 — renomear subconta de reserva é bloqueado', async () => {
    const id = await reserveEur();
    const supabase = await getAuthedClient();

    const result = await updateEnvelopeCore(
      { supabase, session: SEED_SESSION },
      { envelopeId: id, patch: { name: 'Outro nome' } },
    );
    expect(result.ok).toBe(false);

    const admin = getAdminClient();
    const { data } = await admin.from('envelopes').select('name').eq('id', id).single();
    expect(data?.name).toBe(RESERVE_ENVELOPE_NAMES.EUR);
  });

  it('I-RESLOCK2 — deletar subconta de reserva é bloqueado', async () => {
    const id = await reserveEur();
    const supabase = await getAuthedClient();

    const result = await deleteEnvelopeCore(
      { supabase, session: SEED_SESSION },
      { envelopeId: id },
    );
    expect(result.ok).toBe(false);

    const admin = getAdminClient();
    const { data } = await admin.from('envelopes').select('id').eq('id', id).maybeSingle();
    expect(data?.id).toBe(id);
  });

  it('I-RESLOCK3 — alocar saldo na reserva é permitido', async () => {
    const id = await reserveEur();
    const supabase = await getAuthedClient();

    const result = await allocateToEnvelopeCore(
      { supabase, session: SEED_SESSION },
      { envelopeId: id, cents: 25_000 },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('envelopes')
      .select('current_cents')
      .eq('id', id)
      .single();
    expect(data?.current_cents).toBe(25_000);
  });
});
