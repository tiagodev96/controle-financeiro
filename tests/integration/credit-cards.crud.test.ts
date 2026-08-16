import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createCreditCardCore,
  updateCreditCardCore,
  deleteCreditCardCore,
} from '@/server/actions/credit-cards/core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_BRL_ID,
} from './helpers/auth';
import {
  getAdminClient,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

async function cleanupCards(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('credit_cards')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('name', 'CARD test %');
}

describe('credit_cards CRUD (integração)', () => {
  beforeEach(cleanupCards);
  afterEach(cleanupCards);

  it('I-CARD-CRUD1 — cria cartão com fechamento 7 e vencimento 11', async () => {
    const supabase = await getAuthedClient();
    const result = await createCreditCardCore(
      { supabase, session: SEED_SESSION },
      {
        name: 'CARD test Nubank',
        closingDay: 7,
        dueDay: 11,
        creditLimitCents: 500000,
        paymentAccountId: SEED_ACCOUNT_BRL_ID,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.closing_day).toBe(7);
    expect(result.card.due_day).toBe(11);
    expect(result.card.credit_limit_cents).toBe(500000);
    expect(result.card.payment_account_id).toBe(SEED_ACCOUNT_BRL_ID);
    expect(result.card.household_id).toBe(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-CARD-CRUD2 — closing_day fora de 1..31 é rejeitado', async () => {
    const supabase = await getAuthedClient();
    const result = await createCreditCardCore(
      { supabase, session: SEED_SESSION },
      {
        name: 'CARD test inválido',
        closingDay: 0,
        dueDay: 11,
        creditLimitCents: null,
        paymentAccountId: SEED_ACCOUNT_BRL_ID,
      },
    );
    expect(result.ok).toBe(false);
  });

  it('I-CARD-CRUD3 — conta de pagamento de outro household é rejeitada', async () => {
    const { householdId } = await createIsolatedHousehold();
    const admin = getAdminClient();
    const { data: foreignAccount } = await admin
      .from('accounts')
      .insert({
        household_id: householdId,
        name: 'Conta Alheia',
        currency: 'BRL',
      })
      .select('id')
      .single();

    try {
      const supabase = await getAuthedClient();
      const result = await createCreditCardCore(
        { supabase, session: SEED_SESSION },
        {
          name: 'CARD test alheio',
          closingDay: 7,
          dueDay: 11,
          creditLimitCents: null,
          paymentAccountId: foreignAccount!.id,
        },
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/conta/i);
    } finally {
      await deleteIsolatedHousehold(householdId);
    }
  });

  it('I-CARD-CRUD4 — nome duplicado no household é rejeitado', async () => {
    const supabase = await getAuthedClient();
    const input = {
      name: 'CARD test duplicado',
      closingDay: 7,
      dueDay: 11,
      creditLimitCents: null,
      paymentAccountId: SEED_ACCOUNT_BRL_ID,
    };
    const first = await createCreditCardCore({ supabase, session: SEED_SESSION }, input);
    expect(first.ok).toBe(true);
    const second = await createCreditCardCore({ supabase, session: SEED_SESSION }, input);
    expect(second.ok).toBe(false);
  });

  it('I-CARD-CRUD5 — atualiza nome e limite; arquiva e desarquiva', async () => {
    const supabase = await getAuthedClient();
    const created = await createCreditCardCore(
      { supabase, session: SEED_SESSION },
      {
        name: 'CARD test editável',
        closingDay: 7,
        dueDay: 11,
        creditLimitCents: null,
        paymentAccountId: SEED_ACCOUNT_BRL_ID,
      },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateCreditCardCore(
      { supabase, session: SEED_SESSION },
      { cardId: created.card.id, name: 'CARD test renomeado', creditLimitCents: 300000 },
    );
    expect(updated.ok).toBe(true);

    const archived = await updateCreditCardCore(
      { supabase, session: SEED_SESSION },
      { cardId: created.card.id, isArchived: true },
    );
    expect(archived.ok).toBe(true);

    const admin = getAdminClient();
    const { data: row } = await admin
      .from('credit_cards')
      .select('name, credit_limit_cents, is_archived')
      .eq('id', created.card.id)
      .single();
    expect(row?.name).toBe('CARD test renomeado');
    expect(row?.credit_limit_cents).toBe(300000);
    expect(row?.is_archived).toBe(true);
  });

  it('I-CARD-CRUD6 — deletar cartão com compra: compra vira avulsa (set null)', async () => {
    const supabase = await getAuthedClient();
    const created = await createCreditCardCore(
      { supabase, session: SEED_SESSION },
      {
        name: 'CARD test deletável',
        closingDay: 7,
        dueDay: 11,
        creditLimitCents: null,
        paymentAccountId: SEED_ACCOUNT_BRL_ID,
      },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const admin = getAdminClient();
    const { data: txn } = await admin
      .from('transactions')
      .insert({
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        profile_id: SEED_SESSION.userId,
        account_id: SEED_ACCOUNT_BRL_ID,
        direction: 'expense',
        amount_cents: 1000,
        currency: 'BRL',
        description: 'CARD test compra órfã',
        occurred_on: '2026-09-11',
        status: 'pending',
        credit_card_id: created.card.id,
        purchased_on: '2026-08-10',
      })
      .select('id')
      .single();

    const deleted = await deleteCreditCardCore(
      { supabase, session: SEED_SESSION },
      { cardId: created.card.id },
    );
    expect(deleted.ok).toBe(true);

    const { data: orphan } = await admin
      .from('transactions')
      .select('credit_card_id, status')
      .eq('id', txn!.id)
      .single();
    expect(orphan?.credit_card_id).toBeNull();
    expect(orphan?.status).toBe('pending');

    await admin.from('transactions').delete().eq('id', txn!.id);
  });
});
