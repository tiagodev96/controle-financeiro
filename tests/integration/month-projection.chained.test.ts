import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { projectMonth, projectMonthChained } from '@/lib/finance/month-projection';
import {
  getAuthedClient,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_USER_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

// Datas fixas: "hoje" 15/09, mês corrente setembro, alvo outubro/novembro.
const NOW = new Date(2026, 8, 15);
const END_OF_SEPTEMBER = new Date(2026, 8, 30);
const END_OF_OCTOBER = new Date(2026, 9, 31);
const END_OF_NOVEMBER = new Date(2026, 10, 30);

async function clearRecurring(): Promise<void> {
  const admin = getAdminClient();
  await admin.from('recurring_rules').delete().eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
}

async function insertPending(
  description: string,
  occurredOn: string,
  cents: number,
  direction: 'expense' | 'income' = 'expense',
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: SEED_ACCOUNT_EUR_ID,
    category_id: direction === 'expense' ? SEED_CATEGORY_MERCADO_ID : null,
    direction,
    amount_cents: cents,
    currency: 'EUR',
    description,
    occurred_on: occurredOn,
    status: 'pending',
  });
  if (error) throw new Error(`insertPending failed: ${error.message}`);
}

describe('projectMonthChained (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await clearRecurring();
  });
  afterEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await clearRecurring();
  });

  it('I-CHAIN1 — mês futuro parte da sobra projetada do mês anterior, não do saldo de hoje', async () => {
    // Setembro (corrente): despesa 500, entrada 200 → fluxo líquido −300.
    await insertPending('CHAIN set despesa', '2026-09-20', 500);
    await insertPending('CHAIN set entrada', '2026-09-25', 200, 'income');
    // Outubro (alvo): despesa 300.
    await insertPending('CHAIN out despesa', '2026-10-10', 300);

    const supabase = await getAuthedClient();
    const chained = await projectMonthChained({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 10000,
      targetDate: END_OF_OCTOBER,
      now: NOW,
    });

    // 10000 − 500 + 200 (setembro) − 300 (outubro) = 9400.
    expect(chained.sobraProjetadaCents).toBe(9400);

    // Sem encadear seria 10000 − 300 = 9700.
    const flat = await projectMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 10000,
      targetDate: END_OF_OCTOBER,
      now: NOW,
    });
    expect(flat.sobraProjetadaCents).toBe(9700);
  });

  it('I-CHAIN2 — dois meses à frente atravessa outubro acumulando o fluxo', async () => {
    await insertPending('CHAIN set despesa', '2026-09-20', 500);
    await insertPending('CHAIN out despesa', '2026-10-10', 300);
    await insertPending('CHAIN nov despesa', '2026-11-10', 100);

    const supabase = await getAuthedClient();
    const chained = await projectMonthChained({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 10000,
      targetDate: END_OF_NOVEMBER,
      now: NOW,
    });

    // 10000 − 500 − 300 − 100 = 9100.
    expect(chained.sobraProjetadaCents).toBe(9100);
  });

  it('I-CHAIN3 — no mês corrente é idêntico ao projectMonth', async () => {
    await insertPending('CHAIN set despesa', '2026-09-20', 500);

    const supabase = await getAuthedClient();
    const args = {
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR' as const,
      fxRateMap: null,
      accountsTotalInTargetCents: 10000,
      targetDate: END_OF_SEPTEMBER,
      now: NOW,
    };
    const chained = await projectMonthChained(args);
    const flat = await projectMonth(args);
    expect(chained.sobraProjetadaCents).toBe(flat.sobraProjetadaCents);
    expect(chained.sobraProjetadaCents).toBe(9500);
  });

  it('I-CHAIN4 — recorrente virtual do mês intermediário também entra na base', async () => {
    const admin = getAdminClient();
    // Regra mensal de 400 no dia 25 — em setembro ainda não gerada (vira
    // virtual do mês corrente) e em outubro idem.
    await admin.from('recurring_rules').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      title: 'CHAIN aluguel',
      amount_cents: 400,
      currency: 'EUR',
      direction: 'expense',
      category_id: SEED_CATEGORY_MERCADO_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      day_of_month: 25,
    });

    const supabase = await getAuthedClient();
    const chained = await projectMonthChained({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 10000,
      targetDate: END_OF_OCTOBER,
      now: NOW,
    });

    // 10000 − 400 (set, virtual) − 400 (out, virtual) = 9200.
    expect(chained.sobraProjetadaCents).toBe(9200);
  });
});
