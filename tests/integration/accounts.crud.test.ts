import { describe, it, expect, afterEach } from 'vitest';
import {
  createAccountCore,
  renameAccountCore,
  archiveAccountCore,
} from '@/server/actions/accounts/core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

async function cleanupAccountByName(name: string): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('accounts')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .eq('name', name);
}

const NAMES = ['CRUD test acc 1', 'CRUD test acc 2'];

describe('contas CRUD (integração)', () => {
  afterEach(async () => {
    for (const n of NAMES) await cleanupAccountByName(n);
  });

  it('I-ACC-CREATE — cria conta com initialBalanceCents', async () => {
    const supabase = await getAuthedClient();
    const result = await createAccountCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { name: NAMES[0]!, currency: 'BRL', initialBalanceCents: 150_000 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.account).toMatchObject({
      name: NAMES[0],
      currency: 'BRL',
      balance_cents: 150_000,
      is_archived: false,
    });
  });

  it('I-ACC-CREATE-DUP — nome duplicado no mesmo household → ok:false', async () => {
    const supabase = await getAuthedClient();
    const first = await createAccountCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { name: NAMES[0]!, currency: 'EUR', initialBalanceCents: 0 },
    );
    expect(first.ok).toBe(true);

    const dup = await createAccountCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { name: NAMES[0]!, currency: 'EUR', initialBalanceCents: 0 },
    );
    expect(dup.ok).toBe(false);
  });

  it('I-ACC-RENAME — muda name, preserva currency e balance', async () => {
    const supabase = await getAuthedClient();
    const created = await createAccountCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { name: NAMES[0]!, currency: 'EUR', initialBalanceCents: 50_000 },
    );
    if (!created.ok) throw new Error('setup');

    const renamed = await renameAccountCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { accountId: created.account.id, name: NAMES[1]! },
    );
    expect(renamed.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('accounts')
      .select('name, currency, balance_cents')
      .eq('id', created.account.id)
      .single();
    expect(data?.name).toBe(NAMES[1]);
    expect(data?.currency).toBe('EUR');
    expect(data?.balance_cents).toBe(50_000);
  });

  it('I-ACC-ARCHIVE — flipa is_archived', async () => {
    const supabase = await getAuthedClient();
    const created = await createAccountCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { name: NAMES[0]!, currency: 'EUR', initialBalanceCents: 0 },
    );
    if (!created.ok) throw new Error('setup');

    const result = await archiveAccountCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { accountId: created.account.id },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('accounts')
      .select('is_archived')
      .eq('id', created.account.id)
      .single();
    expect(data?.is_archived).toBe(true);
  });
});
