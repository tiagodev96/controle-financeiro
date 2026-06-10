import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMonthlyEssential } from '@/lib/finance/reserva-data';
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

const EMPTY_HOUSEHOLD_ID = '44444444-4444-4444-8444-444444444444';
const RULE_TITLE_PREFIX = 'RES test';

const REF = new Date();

const fxMap: RateMap = {
  EUR_BRL: 6,
  BRL_EUR: 1 / 6,
  rateDate: '2026-01-01',
  isStale: false,
};

function isoAt(monthOffset: number, day = 15): string {
  return new Date(Date.UTC(REF.getFullYear(), REF.getMonth() + monthOffset, day))
    .toISOString()
    .slice(0, 10);
}

async function seedRule(input: {
  amountCents: number;
  currency: 'EUR' | 'BRL';
  frequency?: 'monthly' | 'yearly';
  householdId?: string;
}): Promise<string> {
  const admin = getAdminClient();
  const householdId = input.householdId ?? SEED_DEMO_HOUSEHOLD_ID;
  const { data, error } = await admin
    .from('recurring_rules')
    .insert({
      household_id: householdId,
      title: `${RULE_TITLE_PREFIX} ${input.currency} ${input.amountCents}`,
      amount_cents: input.amountCents,
      currency: input.currency,
      direction: 'expense',
      frequency: input.frequency ?? 'monthly',
      day_of_month: 10,
      // Explícito: o default (current_date do Postgres, UTC) pode cair em
      // "amanhã" do ponto de vista local e o filtro active_from excluiria
      // a regra entre 21h e 0h em fusos negativos.
      active_from: '2020-01-01',
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedRule: ${error?.message}`);
  return data.id;
}

async function seedTxn(input: {
  amountCents: number;
  occurredOn: string;
  categoryId: string;
  currency?: 'EUR' | 'BRL';
  sourceRecurringRuleId?: string;
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
    description: 'RES test txn',
    occurred_on: input.occurredOn,
    paid_on: input.occurredOn,
    status: 'paid',
    source_recurring_rule_id: input.sourceRecurringRuleId ?? null,
  });
  if (error) throw new Error(`seedTxn: ${error.message}`);
}

async function setMercadoEssential(value: boolean): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('categories')
    .update({ is_essential: value })
    .eq('id', SEED_CATEGORY_MERCADO_ID);
  if (error) throw new Error(`setMercadoEssential: ${error.message}`);
}

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  await admin.from('recurring_rules').delete().like('title', `${RULE_TITLE_PREFIX}%`);
  await setMercadoEssential(false);
}

describe('loadMonthlyEssential (integração)', () => {
  beforeEach(async () => {
    await cleanup();
    await setMercadoEssential(true);
  });
  afterEach(cleanup);

  it('I-RES1 — só recorrentes ativas, sem histórico → calibrando, soma normalizada', async () => {
    await seedRule({ amountCents: 5_000, currency: 'EUR', frequency: 'monthly' });
    await seedRule({ amountCents: 120_000, currency: 'EUR', frequency: 'yearly' });

    const supabase = await getAuthedClient();
    const result = await loadMonthlyEssential({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: null,
      now: REF,
    });

    expect(result.cents).toBe(15_000);
    expect(result.variableCalibrating).toBe(true);
  });

  it('I-RES2 — 3 meses de variável-essencial + histórico → recorrente + mediana', async () => {
    await seedRule({ amountCents: 5_000, currency: 'EUR', frequency: 'monthly' });
    // Histórico antes da janela: habilita a parte variável.
    await seedTxn({ amountCents: 9_999, occurredOn: isoAt(-4), categoryId: SEED_CATEGORY_MERCADO_ID });
    await seedTxn({ amountCents: 10_000, occurredOn: isoAt(-3), categoryId: SEED_CATEGORY_MERCADO_ID });
    await seedTxn({ amountCents: 12_000, occurredOn: isoAt(-2), categoryId: SEED_CATEGORY_MERCADO_ID });
    await seedTxn({ amountCents: 8_000, occurredOn: isoAt(-1), categoryId: SEED_CATEGORY_MERCADO_ID });
    // Categoria não-essencial é ignorada.
    await seedTxn({ amountCents: 50_000, occurredOn: isoAt(-1), categoryId: SEED_CATEGORY_RESTAURANTE_ID });

    const supabase = await getAuthedClient();
    const result = await loadMonthlyEssential({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: null,
      now: REF,
    });

    // mediana([10000, 12000, 8000]) = 10000; + recorrente 5000.
    expect(result.cents).toBe(15_000);
    expect(result.variableCalibrating).toBe(false);
  });

  it('I-RES3 — exclui transação variável vinculada a recorrente', async () => {
    const ruleId = await seedRule({ amountCents: 5_000, currency: 'EUR', frequency: 'monthly' });
    await seedTxn({ amountCents: 9_999, occurredOn: isoAt(-4), categoryId: SEED_CATEGORY_MERCADO_ID });
    await seedTxn({ amountCents: 10_000, occurredOn: isoAt(-3), categoryId: SEED_CATEGORY_MERCADO_ID });
    // m-2 só tem uma txn vinculada a recorrente → deve contar 0 nesse mês.
    await seedTxn({
      amountCents: 99_999,
      occurredOn: isoAt(-2),
      categoryId: SEED_CATEGORY_MERCADO_ID,
      sourceRecurringRuleId: ruleId,
    });
    await seedTxn({ amountCents: 20_000, occurredOn: isoAt(-1), categoryId: SEED_CATEGORY_MERCADO_ID });

    const supabase = await getAuthedClient();
    const result = await loadMonthlyEssential({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: null,
      now: REF,
    });

    // mediana([10000, 0, 20000]) = 10000; + recorrente 5000.
    expect(result.cents).toBe(15_000);
  });

  it('I-RES4 — isolamento por household (RLS + filtro)', async () => {
    await seedRule({ amountCents: 5_000, currency: 'EUR', frequency: 'monthly' });
    await seedRule({ amountCents: 99_999, currency: 'EUR', householdId: EMPTY_HOUSEHOLD_ID });

    const supabase = await getAuthedClient();
    const result = await loadMonthlyEssential({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: null,
      now: REF,
    });

    expect(result.cents).toBe(5_000);
  });

  it('I-RES5 — recorrente BRL convertida pra EUR via fxRateMap', async () => {
    await seedRule({ amountCents: 60_000, currency: 'BRL', frequency: 'monthly' });
    await seedRule({ amountCents: 5_000, currency: 'EUR', frequency: 'monthly' });

    const supabase = await getAuthedClient();
    const result = await loadMonthlyEssential({
      supabase,
      householdId: SEED_SESSION.householdId,
      targetCurrency: 'EUR',
      fxRateMap: fxMap,
      now: REF,
    });

    // R$ 600 * (1/6) = € 100 (10000c) + € 50 (5000c) recorrente EUR.
    expect(result.cents).toBe(15_000);
  });
});
