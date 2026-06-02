import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDebtCore } from '@/server/actions/debts/core';
import { registerDebtPaymentCore } from '@/server/actions/debts/register-payment-core';
import { sumDebtPaymentsThisMonth } from '@/lib/finance/debts';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

async function cleanupDebts(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('debts')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'DB monthsum test %');
}

// Determinístico e imune a fuso: monta a data ISO de componentes locais (igual
// ao monthRange da função) e fixa o dia no meio do mês — evita o skew UTC/local
// que toISOString introduz na virada do mês.
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const realNow = new Date();
const now = new Date(realNow.getFullYear(), realNow.getMonth(), 15);
const THIS_MONTH_DAY = isoLocal(now);
const LAST_MONTH_DAY = isoLocal(new Date(realNow.getFullYear(), realNow.getMonth() - 1, 10));

describe('sumDebtPaymentsThisMonth (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await cleanupDebts();
  });
  afterEach(cleanupDebts);

  it('I-RES1 — retorna {} quando nenhuma dívida teve pagamento no mês corrente', async () => {
    const supabase = await getAuthedClient();
    const debt = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB monthsum test sem pgto',
        originalAmountCents: 10_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!debt.ok) throw new Error('setup');

    const map = await sumDebtPaymentsThisMonth(
      supabase,
      SEED_DEMO_HOUSEHOLD_ID,
      now,
    );
    expect(map).toEqual({});
  });

  it('I-RES2 — soma só pagamentos paid + paid_on no mês corrente, agrupado por debt_id', async () => {
    const supabase = await getAuthedClient();
    const a = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB monthsum test A',
        originalAmountCents: 100_000,
        currency: 'EUR',
        priority: 1,
        notes: null,
      },
    );
    const b = await createDebtCore(
      { supabase, session: SEED_SESSION },
      {
        title: 'DB monthsum test B',
        originalAmountCents: 50_000,
        currency: 'EUR',
        priority: 2,
        notes: null,
      },
    );
    if (!a.ok || !b.ok) throw new Error('setup');

    // 2 pagamentos pra A neste mês (somam 30k)
    await registerDebtPaymentCore(
      { supabase, session: SEED_SESSION },
      { debtId: a.debt.id, amountCents: 20_000, accountId: SEED_ACCOUNT_EUR_ID, date: THIS_MONTH_DAY, description: 'A1' },
    );
    await registerDebtPaymentCore(
      { supabase, session: SEED_SESSION },
      { debtId: a.debt.id, amountCents: 10_000, accountId: SEED_ACCOUNT_EUR_ID, date: THIS_MONTH_DAY, description: 'A2' },
    );

    // 1 pagamento pra B neste mês (15k)
    await registerDebtPaymentCore(
      { supabase, session: SEED_SESSION },
      { debtId: b.debt.id, amountCents: 15_000, accountId: SEED_ACCOUNT_EUR_ID, date: THIS_MONTH_DAY, description: 'B1' },
    );

    // 1 pagamento pra A no mês anterior (deve ser ignorado pelo somatório do mês corrente)
    const admin = getAdminClient();
    await admin.from('transactions').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_SESSION.userId,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: null,
      direction: 'expense',
      amount_cents: 5_000,
      currency: 'EUR',
      description: 'A mês passado',
      occurred_on: LAST_MONTH_DAY,
      paid_on: LAST_MONTH_DAY,
      status: 'paid',
      source_debt_id: a.debt.id,
    });

    const map = await sumDebtPaymentsThisMonth(
      supabase,
      SEED_DEMO_HOUSEHOLD_ID,
      now,
    );
    expect(map[a.debt.id]).toBe(30_000);
    expect(map[b.debt.id]).toBe(15_000);
  });
});
