import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateCrossCurrencyMonthStats } from '@/lib/finance/cross-currency-stats';
import { projectMonth } from '@/lib/finance/month-projection';
import {
  getAuthedClient,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_USER_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

// Mês sintético fixo pra controlar o corte de "hoje" de forma determinística.
const TARGET_DATE = new Date(2026, 2, 31); // 2026-03, fim do mês
const NOW = new Date(2026, 2, 15); // "hoje" = 15/03

async function seedPendingExpense(occurredOn: string, cents: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from('transactions').insert({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_USER_ID,
    account_id: SEED_ACCOUNT_EUR_ID,
    category_id: SEED_CATEGORY_MERCADO_ID,
    direction: 'expense',
    amount_cents: cents,
    currency: 'EUR',
    description: `OVD test ${occurredOn}`,
    occurred_on: occurredOn,
    status: 'pending',
  });
  if (error) throw new Error(`seedPendingExpense: ${error.message}`);
}

describe('saldo previsto × despesas em atraso do mês (integração)', () => {
  beforeEach(() => truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID));
  afterEach(() => truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID));

  it('I-OVD1 — atrasada do mês corrente abate o saldo previsto; de mês anterior não', async () => {
    await seedPendingExpense('2026-03-20', 20_000); // pendente futura do mês
    await seedPendingExpense('2026-03-10', 11_000); // atrasada DO MÊS (10 < hoje 15)
    await seedPendingExpense('2026-02-10', 5_000); // atrasada de mês anterior

    const supabase = await getAuthedClient();
    const stats = await calculateCrossCurrencyMonthStats({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 100_000,
      targetDate: TARGET_DATE,
      nowDate: NOW,
    });

    // Buckets de exibição não mudam: atrasadas (qualquer mês) ficam em overdue.
    expect(stats.pendingExpenseCents).toBe(20_000);
    expect(stats.overdueCents).toBe(16_000);
    expect(stats.overdueCount).toBe(2);

    // Saldo previsto: 100.000 − 20.000 (pendente) − 11.000 (atrasada do mês).
    // A de fevereiro fica de fora (dívida velha, não previsão do mês).
    expect(stats.saldoPrevistoFimDoMesCents).toBe(69_000);
  });

  it('I-OVD2 — sobra projetada do mês corrente também desconta a atrasada do mês', async () => {
    await seedPendingExpense('2026-03-20', 20_000);
    await seedPendingExpense('2026-03-10', 11_000);

    const supabase = await getAuthedClient();
    const projection = await projectMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetCurrency: 'EUR',
      fxRateMap: null,
      accountsTotalInTargetCents: 100_000,
      targetDate: TARGET_DATE,
      now: NOW,
    });

    expect(projection.expenseProjectedCents).toBe(31_000);
    expect(projection.sobraProjetadaCents).toBe(69_000);
  });
});
