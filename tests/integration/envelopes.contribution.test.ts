import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEnvelopeCore, updateEnvelopeCore } from '@/server/actions/envelopes/core';
import { getAuthedClient, SEED_SESSION, SEED_DEMO_HOUSEHOLD_ID } from './helpers/auth';
import { getAdminClient } from './helpers/db';

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('envelopes')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('name', 'ENV aporte %');
}

describe('envelopes — aporte mensal (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-ENV-AP1 — create persiste meta + aporte', async () => {
    const supabase = await getAuthedClient();
    const created = await createEnvelopeCore(
      { supabase, session: SEED_SESSION },
      {
        name: 'ENV aporte viagem',
        currency: 'EUR',
        targetCents: 300_000,
        monthlyContributionCents: 50_000,
      },
    );

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.envelope.monthly_contribution_cents).toBe(50_000);
    expect(created.envelope.target_cents).toBe(300_000);
  });

  it('I-ENV-AP2 — update define e limpa o aporte (null)', async () => {
    const supabase = await getAuthedClient();
    const created = await createEnvelopeCore(
      { supabase, session: SEED_SESSION },
      { name: 'ENV aporte notebook', currency: 'EUR', targetCents: 100_000 },
    );
    if (!created.ok) throw new Error('setup');

    const set = await updateEnvelopeCore(
      { supabase, session: SEED_SESSION },
      { envelopeId: created.envelope.id, patch: { monthlyContributionCents: 20_000 } },
    );
    expect(set.ok).toBe(true);

    const admin = getAdminClient();
    const { data: afterSet } = await admin
      .from('envelopes')
      .select('monthly_contribution_cents, target_cents')
      .eq('id', created.envelope.id)
      .single();
    expect(afterSet?.monthly_contribution_cents).toBe(20_000);
    // Patch que não menciona a meta não pode apagá-la.
    expect(afterSet?.target_cents).toBe(100_000);

    const clear = await updateEnvelopeCore(
      { supabase, session: SEED_SESSION },
      { envelopeId: created.envelope.id, patch: { monthlyContributionCents: null } },
    );
    expect(clear.ok).toBe(true);

    const { data: afterClear } = await admin
      .from('envelopes')
      .select('monthly_contribution_cents')
      .eq('id', created.envelope.id)
      .single();
    expect(afterClear?.monthly_contribution_cents).toBeNull();
  });
});
