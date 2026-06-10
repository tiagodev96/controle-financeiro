import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listCategoriesWithLimits } from '@/lib/finance/category-limits';
import type { RateMap } from '@/lib/fx';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_USER_ID,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
  SEED_CATEGORY_RESTAURANTE_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

const fxMap: RateMap = {
  EUR_BRL: 6,
  BRL_EUR: 1 / 6,
  rateDate: '2026-01-01',
  isStale: false,
};

async function setLimit(
  categoryId: string,
  cents: number | null,
  currency: 'EUR' | 'BRL' | null,
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('categories')
    .update({ monthly_limit_cents: cents, limit_currency: currency })
    .eq('id', categoryId);
  if (error) throw new Error(`setLimit: ${error.message}`);
}

async function seedExpense(input: {
  categoryId: string;
  amountCents: number;
  currency?: 'EUR' | 'BRL';
  occurredOn?: string;
}): Promise<void> {
  const admin = getAdminClient();
  const currency = input.currency ?? 'EUR';
  const { error } = await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: currency === 'EUR' ? SEED_ACCOUNT_EUR_ID : SEED_ACCOUNT_BRL_ID,
    category_id: input.categoryId,
    direction: 'expense',
    amount_cents: input.amountCents,
    currency,
    description: 'CL test txn',
    occurred_on: input.occurredOn ?? new Date().toISOString().slice(0, 10),
    status: 'paid',
    paid_on: input.occurredOn ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(`seedExpense: ${error.message}`);
}

function lastMonthIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 15)).toISOString().slice(0, 10);
}

async function cleanup(): Promise<void> {
  await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  await setLimit(SEED_CATEGORY_MERCADO_ID, null, null);
  await setLimit(SEED_CATEGORY_RESTAURANTE_ID, null, null);
}

describe('listCategoriesWithLimits (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-CL1 — gasto abaixo de 80% → status ok, pct correto', async () => {
    await setLimit(SEED_CATEGORY_MERCADO_ID, 100_000, 'EUR');
    await seedExpense({ categoryId: SEED_CATEGORY_MERCADO_ID, amountCents: 50_000 });

    const supabase = await getAuthedClient();
    const limits = await listCategoriesWithLimits(supabase, SEED_SESSION.householdId, fxMap);

    expect(limits).toHaveLength(1);
    expect(limits[0]).toMatchObject({
      id: SEED_CATEGORY_MERCADO_ID,
      limitCents: 100_000,
      limitCurrency: 'EUR',
      spentCents: 50_000,
      status: 'ok',
      fxIncomplete: false,
    });
    expect(limits[0]?.pct).toBeCloseTo(0.5);
  });

  it('I-CL2 — 80% vira warning, 100% vira over', async () => {
    await setLimit(SEED_CATEGORY_MERCADO_ID, 100_000, 'EUR');
    await setLimit(SEED_CATEGORY_RESTAURANTE_ID, 50_000, 'EUR');
    await seedExpense({ categoryId: SEED_CATEGORY_MERCADO_ID, amountCents: 80_000 });
    await seedExpense({ categoryId: SEED_CATEGORY_RESTAURANTE_ID, amountCents: 60_000 });

    const supabase = await getAuthedClient();
    const limits = await listCategoriesWithLimits(supabase, SEED_SESSION.householdId, fxMap);

    const mercado = limits.find((l) => l.id === SEED_CATEGORY_MERCADO_ID);
    const restaurante = limits.find((l) => l.id === SEED_CATEGORY_RESTAURANTE_ID);
    expect(mercado?.status).toBe('warning');
    expect(restaurante?.status).toBe('over');
    // Ordenado por pct desc — quem estourou vem primeiro.
    expect(limits[0]?.id).toBe(SEED_CATEGORY_RESTAURANTE_ID);
  });

  it('I-CL3 — gasto em BRL convertido pra limite em EUR via fx', async () => {
    await setLimit(SEED_CATEGORY_MERCADO_ID, 100_000, 'EUR');
    await seedExpense({ categoryId: SEED_CATEGORY_MERCADO_ID, amountCents: 30_000 });
    // R$ 1.200,00 / 6 = € 200,00.
    await seedExpense({
      categoryId: SEED_CATEGORY_MERCADO_ID,
      amountCents: 120_000,
      currency: 'BRL',
    });

    const supabase = await getAuthedClient();
    const limits = await listCategoriesWithLimits(supabase, SEED_SESSION.householdId, fxMap);

    expect(limits[0]?.spentCents).toBe(50_000);
    expect(limits[0]?.fxIncomplete).toBe(false);
  });

  it('I-CL4 — sem fx, gasto em moeda diferente é excluído e flagga fxIncomplete', async () => {
    await setLimit(SEED_CATEGORY_MERCADO_ID, 100_000, 'EUR');
    await seedExpense({ categoryId: SEED_CATEGORY_MERCADO_ID, amountCents: 30_000 });
    await seedExpense({
      categoryId: SEED_CATEGORY_MERCADO_ID,
      amountCents: 120_000,
      currency: 'BRL',
    });

    const supabase = await getAuthedClient();
    const limits = await listCategoriesWithLimits(supabase, SEED_SESSION.householdId, null);

    expect(limits[0]?.spentCents).toBe(30_000);
    expect(limits[0]?.fxIncomplete).toBe(true);
  });

  it('I-CL5 — só categorias com limite aparecem; gasto de mês anterior fica fora', async () => {
    await setLimit(SEED_CATEGORY_MERCADO_ID, 100_000, 'EUR');
    await seedExpense({ categoryId: SEED_CATEGORY_MERCADO_ID, amountCents: 20_000 });
    await seedExpense({
      categoryId: SEED_CATEGORY_MERCADO_ID,
      amountCents: 99_000,
      occurredOn: lastMonthIso(),
    });
    // Restaurante sem limite — não deve aparecer mesmo com gasto.
    await seedExpense({ categoryId: SEED_CATEGORY_RESTAURANTE_ID, amountCents: 10_000 });

    const supabase = await getAuthedClient();
    const limits = await listCategoriesWithLimits(supabase, SEED_SESSION.householdId, fxMap);

    expect(limits).toHaveLength(1);
    expect(limits[0]?.id).toBe(SEED_CATEGORY_MERCADO_ID);
    expect(limits[0]?.spentCents).toBe(20_000);
  });
});
