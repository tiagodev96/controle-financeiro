import { describe, it, expect, afterEach } from 'vitest';
import {
  createDebtCore,
  closeDebtManuallyCore,
  reopenDebtCore,
} from '@/server/actions/debts/core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
} from './helpers/auth';
import { getAdminClient } from './helpers/db';

async function cleanupDebts(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('debts')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'DB test %');
}

describe('debts CRUD core (integração)', () => {
  afterEach(cleanupDebts);

  it('I-DB-CRUD — cria debt e retorna row com remaining=original', async () => {
    const supabase = await getAuthedClient();
    const result = await createDebtCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        title: 'DB test Jefferson',
        originalAmountCents: 300_000,
        currency: 'EUR',
        priority: 1,
        notes: null,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.debt).toMatchObject({
      title: 'DB test Jefferson',
      original_amount_cents: 300_000,
      remaining_amount_cents: 300_000,
      currency: 'EUR',
      priority: 1,
      status: 'open',
    });
  });

  it('I-DB-CLOSE-MANUAL — close + reopen', async () => {
    const supabase = await getAuthedClient();
    const created = await createDebtCore(
      { supabase, session: SEED_TIAGO_SESSION },
      {
        title: 'DB test perdoada',
        originalAmountCents: 100_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!created.ok) throw new Error('setup');

    const closed = await closeDebtManuallyCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { debtId: created.debt.id },
    );
    expect(closed.ok).toBe(true);

    const admin = getAdminClient();
    const { data: afterClose } = await admin
      .from('debts')
      .select('status, closed_at, remaining_amount_cents')
      .eq('id', created.debt.id)
      .single();
    expect(afterClose?.status).toBe('closed');
    expect(afterClose?.closed_at).not.toBeNull();
    // close manual NÃO zera remaining
    expect(afterClose?.remaining_amount_cents).toBe(100_000);

    const reopened = await reopenDebtCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { debtId: created.debt.id },
    );
    expect(reopened.ok).toBe(true);

    const { data: afterReopen } = await admin
      .from('debts')
      .select('status, closed_at')
      .eq('id', created.debt.id)
      .single();
    expect(afterReopen?.status).toBe('open');
    expect(afterReopen?.closed_at).toBeNull();
  });
});
