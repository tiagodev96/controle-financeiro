import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadCategoryTrend, loadMonthlyFlow } from '@/lib/finance/category-trend';
import { monthIso, toLocalIsoDate } from '@/lib/dates';
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

const NOW = new Date();

const fxMap: RateMap = {
  EUR_BRL: 6,
  BRL_EUR: 1 / 6,
  rateDate: '2026-01-01',
  isStale: false,
};

function monthsAgoIso(n: number, day = 15): string {
  return toLocalIsoDate(new Date(NOW.getFullYear(), NOW.getMonth() - n, day));
}

function monthsAgoYm(n: number): string {
  return monthIso(new Date(NOW.getFullYear(), NOW.getMonth() - n, 1));
}

async function seedTxn(input: {
  amountCents: number;
  occurredOn: string;
  direction?: 'expense' | 'income';
  categoryId?: string | null;
  currency?: 'EUR' | 'BRL';
  status?: 'paid' | 'pending';
}): Promise<void> {
  const admin = getAdminClient();
  const currency = input.currency ?? 'EUR';
  const status = input.status ?? 'paid';
  const { error } = await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: currency === 'EUR' ? SEED_ACCOUNT_EUR_ID : SEED_ACCOUNT_BRL_ID,
    category_id: input.categoryId === undefined ? SEED_CATEGORY_MERCADO_ID : input.categoryId,
    direction: input.direction ?? 'expense',
    amount_cents: input.amountCents,
    currency,
    description: 'CT test txn',
    occurred_on: input.occurredOn,
    paid_on: status === 'paid' ? input.occurredOn : null,
    status,
  });
  if (error) throw new Error(`seedTxn: ${error.message}`);
}

describe('category-trend (integração)', () => {
  beforeEach(() => truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID));
  afterEach(() => truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID));

  it('I-CT1 — série por categoria com pontos zerados nos meses sem gasto', async () => {
    await seedTxn({ amountCents: 50_000, occurredOn: monthsAgoIso(2) });
    await seedTxn({ amountCents: 30_000, occurredOn: monthsAgoIso(0) });
    await seedTxn({
      amountCents: 20_000,
      occurredOn: monthsAgoIso(1),
      categoryId: SEED_CATEGORY_RESTAURANTE_ID,
    });

    const supabase = await getAuthedClient();
    const result = await loadCategoryTrend(supabase, SEED_SESSION.householdId, {
      currency: 'EUR',
      fxRateMap: fxMap,
      now: NOW,
      monthsCount: 6,
      topCount: 5,
    });

    expect(result.months).toHaveLength(6);
    expect(result.months[5]).toBe(monthsAgoYm(0));
    expect(result.months[0]).toBe(monthsAgoYm(5));

    const mercado = result.series.find((s) => s.name === 'Mercado');
    expect(mercado?.totalCents).toBe(80_000);
    expect(mercado?.points).toHaveLength(6);
    expect(mercado?.points[3]).toEqual({ monthIso: monthsAgoYm(2), totalCents: 50_000 });
    expect(mercado?.points[4]).toEqual({ monthIso: monthsAgoYm(1), totalCents: 0 });
    expect(mercado?.points[5]).toEqual({ monthIso: monthsAgoYm(0), totalCents: 30_000 });

    // Ordenado por total desc — Mercado antes de Restaurante.
    expect(result.series.map((s) => s.name)).toEqual(['Mercado', 'Restaurante']);
    expect(result.fxIncomplete).toBe(false);
  });

  it('I-CT2 — converte BRL pra EUR e flagga parcial sem fx', async () => {
    await seedTxn({ amountCents: 120_000, occurredOn: monthsAgoIso(0), currency: 'BRL' });

    const supabase = await getAuthedClient();
    const withFx = await loadCategoryTrend(supabase, SEED_SESSION.householdId, {
      currency: 'EUR',
      fxRateMap: fxMap,
      now: NOW,
    });
    expect(withFx.series[0]?.totalCents).toBe(20_000);

    const withoutFx = await loadCategoryTrend(supabase, SEED_SESSION.householdId, {
      currency: 'EUR',
      fxRateMap: null,
      now: NOW,
    });
    expect(withoutFx.fxIncomplete).toBe(true);
    expect(withoutFx.series).toHaveLength(0);
  });

  it('I-CT3 — topCount corta e soma o resto em othersTotalCents; sem categoria vira "Sem categoria"', async () => {
    await seedTxn({ amountCents: 50_000, occurredOn: monthsAgoIso(0) });
    await seedTxn({
      amountCents: 30_000,
      occurredOn: monthsAgoIso(0),
      categoryId: SEED_CATEGORY_RESTAURANTE_ID,
    });
    await seedTxn({ amountCents: 10_000, occurredOn: monthsAgoIso(0), categoryId: null });

    const supabase = await getAuthedClient();
    const result = await loadCategoryTrend(supabase, SEED_SESSION.householdId, {
      currency: 'EUR',
      fxRateMap: fxMap,
      now: NOW,
      topCount: 2,
    });

    expect(result.series.map((s) => s.name)).toEqual(['Mercado', 'Restaurante']);
    expect(result.othersTotalCents).toBe(10_000);
  });

  it('I-CT4 — fluxo mensal: entradas e despesas pagas por mês, net correto', async () => {
    await seedTxn({ amountCents: 300_000, occurredOn: monthsAgoIso(1), direction: 'income' });
    await seedTxn({ amountCents: 100_000, occurredOn: monthsAgoIso(1) });
    // Pendente não entra no fluxo (sobra = fluxo realizado).
    await seedTxn({ amountCents: 999_000, occurredOn: monthsAgoIso(1), status: 'pending' });

    const supabase = await getAuthedClient();
    const result = await loadMonthlyFlow(supabase, SEED_SESSION.householdId, {
      currency: 'EUR',
      fxRateMap: fxMap,
      now: NOW,
      monthsCount: 6,
    });

    expect(result.months).toHaveLength(6);
    const target = result.months.find((m) => m.monthIso === monthsAgoYm(1));
    expect(target).toEqual({
      monthIso: monthsAgoYm(1),
      incomeCents: 300_000,
      expenseCents: 100_000,
      netCents: 200_000,
    });
    const empty = result.months.find((m) => m.monthIso === monthsAgoYm(3));
    expect(empty?.netCents).toBe(0);
  });
});
