import { describe, it, expect, beforeEach } from 'vitest';
import { createTransactionForSession } from '@/server/actions/transactions/create-core';
import { markPaidCore } from '@/server/actions/transactions/mark-paid-core';
import { deleteTransactionCore } from '@/server/actions/transactions/delete-core';
import { updateTransactionCore } from '@/server/actions/transactions/update-core';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import {
  truncateHouseholdTransactions,
  getAdminClient,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

const TODAY = new Date().toISOString().slice(0, 10);

async function setBalance(accountId: string, balanceCents: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('accounts')
    .update({ balance_cents: balanceCents })
    .eq('id', accountId);
  if (error) throw new Error(`setBalance: ${error.message}`);
}

async function getBalance(accountId: string): Promise<number> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('accounts')
    .select('balance_cents')
    .eq('id', accountId)
    .single();
  if (error || !data) throw new Error(`getBalance: ${error?.message}`);
  return data.balance_cents;
}

async function seedRate(eurBrl: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('fx_rates_cache')
    .upsert(
      { rate_date: TODAY, base: 'EUR', quote: 'BRL', rate: eurBrl },
      { onConflict: 'rate_date,base,quote' },
    );
  if (error) throw new Error(`seedRate: ${error.message}`);
}

async function listTransfers(): Promise<
  Array<{
    from_account_id: string;
    to_account_id: string;
    from_amount_cents: number;
    to_amount_cents: number;
    rate: number | null;
  }>
> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('account_transfers')
    .select('from_account_id, to_account_id, from_amount_cents, to_amount_cents, rate')
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
  if (error) throw new Error(`listTransfers: ${error.message}`);
  return data ?? [];
}

async function seedPendingExpense(
  accountId: string,
  amountCents: number,
  currency: 'BRL' | 'EUR',
): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('transactions')
    .insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_SESSION.userId,
      account_id: accountId,
      category_id: SEED_CATEGORY_MERCADO_ID,
      direction: 'expense',
      amount_cents: amountCents,
      currency,
      description: 'pendente cobertura',
      occurred_on: TODAY,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedPendingExpense: ${error?.message}`);
  return data.id;
}

const baseBrlExpense = {
  description: 'Conta de luz',
  categoryId: SEED_CATEGORY_MERCADO_ID,
  accountId: SEED_ACCOUNT_BRL_ID,
  direction: 'expense',
  paid: true,
  updateBalance: true,
  date: TODAY,
} as const;

describe('cobertura automática de pagamento (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    const admin = getAdminClient();
    await admin.from('account_transfers').delete().eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
    await setBalance(SEED_ACCOUNT_EUR_ID, 0);
    await setBalance(SEED_ACCOUNT_BRL_ID, 0);
    await seedRate(6);
  });

  it('I-COV1 — €100/R$0, paga R$12: BRL fica 0, EUR vira 98, gera conversão', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const supabase = await getAuthedClient();

    const result = await createTransactionForSession(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { ...baseBrlExpense, amountCents: 1200 },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transaction).toMatchObject({
      account_id: SEED_ACCOUNT_BRL_ID,
      currency: 'BRL',
      amount_cents: 1200,
      status: 'paid',
    });

    expect(await getBalance(SEED_ACCOUNT_BRL_ID)).toBe(0);
    expect(await getBalance(SEED_ACCOUNT_EUR_ID)).toBe(9800);

    const transfers = await listTransfers();
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({
      from_account_id: SEED_ACCOUNT_EUR_ID,
      to_account_id: SEED_ACCOUNT_BRL_ID,
      from_amount_cents: 200,
      to_amount_cents: 1200,
    });
    expect(Number(transfers[0]?.rate)).toBe(6);
  });

  it('I-COV2 — marcar pendente como paga dispara a mesma cobertura', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const txnId = await seedPendingExpense(SEED_ACCOUNT_BRL_ID, 1200, 'BRL');
    const supabase = await getAuthedClient();

    const result = await markPaidCore(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { transactionId: txnId },
    );

    expect(result.ok).toBe(true);
    expect(await getBalance(SEED_ACCOUNT_BRL_ID)).toBe(0);
    expect(await getBalance(SEED_ACCOUNT_EUR_ID)).toBe(9800);
    expect(await listTransfers()).toHaveLength(1);
  });

  it('I-COV3 — cobertura parcial mista: usa R$5 próprios e converte os R$7 restantes', async () => {
    await setBalance(SEED_ACCOUNT_BRL_ID, 500);
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const supabase = await getAuthedClient();

    const result = await createTransactionForSession(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { ...baseBrlExpense, amountCents: 1200 },
    );

    expect(result.ok).toBe(true);
    expect(await getBalance(SEED_ACCOUNT_BRL_ID)).toBe(0);
    // €100 − €1,17 (=R$7) = €98,83
    expect(await getBalance(SEED_ACCOUNT_EUR_ID)).toBe(10_000 - 117);

    const transfers = await listTransfers();
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ from_amount_cents: 117, to_amount_cents: 700 });
  });

  it('I-COV4 — excluir despesa paga reverte a conversão (volta €100/R$0)', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const supabase = await getAuthedClient();

    const created = await createTransactionForSession(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { ...baseBrlExpense, amountCents: 1200 },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const del = await deleteTransactionCore(
      { supabase, session: SEED_SESSION },
      { id: created.transaction.id },
    );
    expect(del.ok).toBe(true);

    expect(await getBalance(SEED_ACCOUNT_EUR_ID)).toBe(10_000);
    expect(await getBalance(SEED_ACCOUNT_BRL_ID)).toBe(0);
    expect(await listTransfers()).toHaveLength(0);
  });

  it('I-COV5 — desmarcar como paga reverte a conversão', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const supabase = await getAuthedClient();

    const created = await createTransactionForSession(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { ...baseBrlExpense, amountCents: 1200 },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const upd = await updateTransactionCore(
      { supabase, session: SEED_SESSION },
      { id: created.transaction.id, patch: { paid: false } },
    );
    expect(upd.ok).toBe(true);

    expect(await getBalance(SEED_ACCOUNT_EUR_ID)).toBe(10_000);
    expect(await getBalance(SEED_ACCOUNT_BRL_ID)).toBe(0);
    expect(await listTransfers()).toHaveLength(0);
  });

  it('I-COV6 — editar o valor de despesa paga recomputa a cobertura', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const supabase = await getAuthedClient();

    const created = await createTransactionForSession(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { ...baseBrlExpense, amountCents: 1200 },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const upd = await updateTransactionCore(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { id: created.transaction.id, patch: { amountCents: 600 } },
    );
    expect(upd.ok).toBe(true);

    // R$6 = €1, então EUR perde só €1.
    expect(await getBalance(SEED_ACCOUNT_BRL_ID)).toBe(0);
    expect(await getBalance(SEED_ACCOUNT_EUR_ID)).toBe(10_000 - 100);
    const transfers = await listTransfers();
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({ from_amount_cents: 100, to_amount_cents: 600 });
  });

  it('I-COV7 — cobertura não cria linhas de receita/despesa em transactions', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const supabase = await getAuthedClient();

    await createTransactionForSession(
      { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() },
      { ...baseBrlExpense, amountCents: 1200 },
    );

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
    expect(count).toBe(1);
  });

  it('I-COV8 — RLS: outro household não enxerga account_transfers', async () => {
    const isolated = await createIsolatedHousehold();
    try {
      const admin = getAdminClient();
      const { data: acc } = await admin
        .from('accounts')
        .insert([
          { household_id: isolated.householdId, name: 'A', currency: 'EUR', balance_cents: 0, sort_order: 1 },
          { household_id: isolated.householdId, name: 'B', currency: 'BRL', balance_cents: 0, sort_order: 2 },
        ])
        .select('id');
      const [a, b] = acc ?? [];
      await admin.from('account_transfers').insert({
        household_id: isolated.householdId,
        profile_id: SEED_SESSION.userId,
        from_account_id: a!.id,
        to_account_id: b!.id,
        from_amount_cents: 100,
        to_amount_cents: 600,
        from_currency: 'EUR',
        to_currency: 'BRL',
        rate: 6,
        occurred_on: TODAY,
      });

      const supabase = await getAuthedClient();
      const { data } = await supabase
        .from('account_transfers')
        .select('id')
        .eq('household_id', isolated.householdId);
      expect(data ?? []).toHaveLength(0);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });

  it('I-COV9 — câmbio indisponível: não gera conversão, conta fica negativa', async () => {
    await setBalance(SEED_ACCOUNT_EUR_ID, 10_000);
    const admin = getAdminClient();
    await admin.from('fx_rates_cache').delete().eq('rate_date', TODAY);
    const supabase = await getAuthedClient();

    // Sem serviceSupabase: o caminho de cobertura cross-currency é pulado.
    const result = await createTransactionForSession(
      { supabase, session: SEED_SESSION },
      { ...baseBrlExpense, amountCents: 1200 },
    );

    expect(result.ok).toBe(true);
    expect(await getBalance(SEED_ACCOUNT_BRL_ID)).toBe(-1200);
    expect(await getBalance(SEED_ACCOUNT_EUR_ID)).toBe(10_000);
    expect(await listTransfers()).toHaveLength(0);
  });
});
