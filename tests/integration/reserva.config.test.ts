import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setReserveEnvelopeCore,
  setCategoryEssentialCore,
} from '@/server/actions/reserva/core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

const NAME_PREFIX = 'RESCFG test';
let counter = 0;

async function seedEnvelope(): Promise<string> {
  const admin = getAdminClient();
  counter += 1;
  const { data, error } = await admin
    .from('envelopes')
    .insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      name: `${NAME_PREFIX} ${counter}`,
      currency: 'EUR',
      current_cents: 0,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedEnvelope: ${error?.message}`);
  return data.id;
}

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await admin.from('envelopes').delete().like('name', `${NAME_PREFIX}%`);
  await admin
    .from('categories')
    .update({ is_essential: false })
    .eq('id', SEED_CATEGORY_MERCADO_ID);
}

describe('reserva config (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-RESCFG1 — designar reserva e trocar desmarca a anterior (single reserve)', async () => {
    const first = await seedEnvelope();
    const second = await seedEnvelope();
    const supabase = await getAuthedClient();

    const r1 = await setReserveEnvelopeCore({ supabase, session: SEED_SESSION }, { envelopeId: first });
    expect(r1.ok).toBe(true);

    const r2 = await setReserveEnvelopeCore({ supabase, session: SEED_SESSION }, { envelopeId: second });
    expect(r2.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('envelopes')
      .select('id, is_reserve')
      .in('id', [first, second]);
    const reserves = (data ?? []).filter((e) => e.is_reserve);
    expect(reserves).toHaveLength(1);
    expect(reserves[0]?.id).toBe(second);
  });

  it('I-RESCFG2 — marcar e desmarcar categoria essencial', async () => {
    const supabase = await getAuthedClient();

    const on = await setCategoryEssentialCore(
      { supabase, session: SEED_SESSION },
      { categoryId: SEED_CATEGORY_MERCADO_ID, isEssential: true },
    );
    expect(on.ok).toBe(true);

    const admin = getAdminClient();
    const { data: afterOn } = await admin
      .from('categories')
      .select('is_essential')
      .eq('id', SEED_CATEGORY_MERCADO_ID)
      .single();
    expect(afterOn?.is_essential).toBe(true);

    const off = await setCategoryEssentialCore(
      { supabase, session: SEED_SESSION },
      { categoryId: SEED_CATEGORY_MERCADO_ID, isEssential: false },
    );
    expect(off.ok).toBe(true);

    const { data: afterOff } = await admin
      .from('categories')
      .select('is_essential')
      .eq('id', SEED_CATEGORY_MERCADO_ID)
      .single();
    expect(afterOff?.is_essential).toBe(false);
  });

  it('I-RESCFG3 — categoria de outro household → not found', async () => {
    const supabase = await getAuthedClient();
    const result = await setCategoryEssentialCore(
      { supabase, session: SEED_SESSION },
      { categoryId: '00000000-0000-4000-8000-0000000000ff', isEssential: true },
    );
    expect(result.ok).toBe(false);
  });
});
