import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { topCategoriesCrossCurrency } from '@/lib/finance/dashboard-stats';
import {
  getAuthedClient,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_USER_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
  SEED_CATEGORY_RESTAURANTE_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';
import type { RateMap } from '@/lib/fx';

const RATE_MAP: RateMap = {
  EUR_BRL: 6.2,
  BRL_EUR: 1 / 6.2,
  rateDate: '2026-01-01',
  isStale: false,
};

function thisMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
}

async function insertExpense(
  accountId: string,
  categoryId: string,
  currency: 'EUR' | 'BRL',
  amountCents: number,
  status: 'paid' | 'pending' = 'paid',
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: accountId,
    category_id: categoryId,
    direction: 'expense',
    amount_cents: amountCents,
    currency,
    description: `Test ${currency}`,
    occurred_on: thisMonthIso(),
    status,
    paid_on: status === 'paid' ? thisMonthIso() : null,
    installment_number: 1,
  });
  if (error) throw new Error(`insertExpense failed: ${error.message}`);
}

describe('topCategoriesCrossCurrency (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });
  afterEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-TOPCAT1 — agrega EUR+BRL convertidos pra EUR quando displayCurrency=EUR', async () => {
    // Mercado: 100 EUR. Restaurante: 620 BRL ≈ 100 EUR @ 6.2.
    await insertExpense(SEED_ACCOUNT_EUR_ID, SEED_CATEGORY_MERCADO_ID, 'EUR', 10000);
    await insertExpense(SEED_ACCOUNT_BRL_ID, SEED_CATEGORY_RESTAURANTE_ID, 'BRL', 62000);

    const supabase = await getAuthedClient();
    const result = await topCategoriesCrossCurrency({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      displayCurrency: 'EUR',
      fxRateMap: RATE_MAP,
    });

    expect(result.fxIncomplete).toBe(false);
    expect(result.rows).toHaveLength(2);
    // Restaurante: convertCents(62000, 1/6.2) == 10000 (HALF_EVEN)
    const totalsMapped = Object.fromEntries(result.rows.map((r) => [r.name, r.totalCents]));
    expect(totalsMapped['Mercado']).toBe(10000);
    expect(totalsMapped['Restaurante']).toBeCloseTo(10000, -1);
    // pctOfMax: ambas ≈ 1.0 ou 0.something — a maior tem 1.0
    expect(result.rows[0]?.pctOfMax).toBe(1);
  });

  it('I-TOPCAT2 — agrega EUR+BRL convertidos pra BRL quando displayCurrency=BRL', async () => {
    // Mercado: 100 EUR = 620 BRL. Restaurante: 310 BRL.
    await insertExpense(SEED_ACCOUNT_EUR_ID, SEED_CATEGORY_MERCADO_ID, 'EUR', 10000);
    await insertExpense(SEED_ACCOUNT_BRL_ID, SEED_CATEGORY_RESTAURANTE_ID, 'BRL', 31000);

    const supabase = await getAuthedClient();
    const result = await topCategoriesCrossCurrency({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      displayCurrency: 'BRL',
      fxRateMap: RATE_MAP,
    });

    expect(result.fxIncomplete).toBe(false);
    expect(result.rows).toHaveLength(2);
    const [first, second] = result.rows;
    expect(first?.name).toBe('Mercado');
    expect(first?.totalCents).toBe(62000);
    expect(first?.pctOfMax).toBe(1);
    expect(second?.name).toBe('Restaurante');
    expect(second?.totalCents).toBe(31000);
    expect(second?.pctOfMax).toBeCloseTo(0.5, 2);
  });

  it('I-TOPCAT3 — sem rateMap, txns da outra moeda ficam fora e fxIncomplete=true', async () => {
    // Mercado: 100 EUR. Restaurante: 620 BRL. Sem câmbio → BRL fica de fora.
    await insertExpense(SEED_ACCOUNT_EUR_ID, SEED_CATEGORY_MERCADO_ID, 'EUR', 10000);
    await insertExpense(SEED_ACCOUNT_BRL_ID, SEED_CATEGORY_RESTAURANTE_ID, 'BRL', 62000);

    const supabase = await getAuthedClient();
    const result = await topCategoriesCrossCurrency({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      displayCurrency: 'EUR',
      fxRateMap: null,
    });

    expect(result.fxIncomplete).toBe(true);
    // Só Mercado em EUR aparece
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.name).toBe('Mercado');
    expect(result.rows[0]?.totalCents).toBe(10000);
    expect(result.rows[0]?.pctOfMax).toBe(1);
  });

  it('I-TOPCAT4 — inclui despesas paid e pending do mês; exclui income', async () => {
    await insertExpense(SEED_ACCOUNT_EUR_ID, SEED_CATEGORY_MERCADO_ID, 'EUR', 5000, 'paid');
    await insertExpense(SEED_ACCOUNT_EUR_ID, SEED_CATEGORY_MERCADO_ID, 'EUR', 3000, 'pending');
    // Inserir income manualmente — deve ser ignorado
    const admin = getAdminClient();
    const { error } = await admin.from('transactions').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_USER_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: SEED_CATEGORY_MERCADO_ID,
      direction: 'income',
      amount_cents: 100000,
      currency: 'EUR',
      description: 'Salário',
      occurred_on: thisMonthIso(),
      status: 'paid',
      paid_on: thisMonthIso(),
      installment_number: 1,
    });
    if (error) throw new Error(`insert income failed: ${error.message}`);

    const supabase = await getAuthedClient();
    const result = await topCategoriesCrossCurrency({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      displayCurrency: 'EUR',
      fxRateMap: RATE_MAP,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.totalCents).toBe(8000);
  });
});
