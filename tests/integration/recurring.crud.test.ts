import { describe, it, expect, afterEach } from 'vitest';
import {
  createRecurringCore,
  pauseRecurringCore,
  resumeRecurringCore,
} from '@/server/actions/recurring/core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

async function cleanupRecurring(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'RR test %');
}

describe('recurring CRUD core (integração)', () => {
  afterEach(cleanupRecurring);

  it('I-RR-CRUD — cria regra válida e retorna a row', async () => {
    const supabase = await getAuthedClient();
    const result = await createRecurringCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'RR test aluguel',
        amountCents: 80000,
        direction: 'expense',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        dayOfMonth: 5,
        notes: null,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rule).toMatchObject({
      title: 'RR test aluguel',
      amount_cents: 80000,
      direction: 'expense',
      day_of_month: 5,
      currency: 'EUR',
      is_paused: false,
    });
  });

  it('I-RR-PAUSE — pause flipa is_paused; resume volta', async () => {
    const supabase = await getAuthedClient();
    const created = await createRecurringCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'RR test pause',
        amountCents: 5000,
        direction: 'expense',
        categoryId: SEED_CATEGORY_MERCADO_ID,
        accountId: SEED_ACCOUNT_EUR_ID,
        dayOfMonth: 10,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const paused = await pauseRecurringCore(
      { supabase, session: SEED_SESSION },
      { ruleId: created.rule.id },
    );
    expect(paused.ok).toBe(true);

    const admin = getAdminClient();
    const after = await admin
      .from('recurring_rules')
      .select('is_paused')
      .eq('id', created.rule.id)
      .single();
    expect(after.data?.is_paused).toBe(true);

    const resumed = await resumeRecurringCore(
      { supabase, session: SEED_SESSION },
      { ruleId: created.rule.id },
    );
    expect(resumed.ok).toBe(true);

    const after2 = await admin
      .from('recurring_rules')
      .select('is_paused')
      .eq('id', created.rule.id)
      .single();
    expect(after2.data?.is_paused).toBe(false);
  });
});
