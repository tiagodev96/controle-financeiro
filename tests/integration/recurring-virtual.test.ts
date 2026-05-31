import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { listUngeneratedRecurringForMonth } from '@/lib/finance/recurring';
import {
  getAuthedClient,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_USER_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

function nextMonth(now: Date): { targetDate: Date; ym: string } {
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const ym = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
  const targetDate = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { targetDate, ym };
}

function isoMonthStart(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

type RuleSeed = {
  title: string;
  direction: 'expense' | 'income';
  amount_cents: number;
  day_of_month: number;
  is_paused?: boolean;
  active_from?: string;
};

async function insertRule(seed: RuleSeed): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('recurring_rules')
    .insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      title: seed.title,
      amount_cents: seed.amount_cents,
      currency: 'EUR',
      direction: seed.direction,
      category_id: SEED_CATEGORY_MERCADO_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      day_of_month: seed.day_of_month,
      frequency: 'monthly',
      is_paused: seed.is_paused ?? false,
      active_from: seed.active_from ?? isoMonthStart(new Date()),
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`insertRule failed: ${error?.message}`);
  return data.id;
}

async function clearRules(): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
  if (error) throw new Error(`clearRules failed: ${error.message}`);
}

describe('listUngeneratedRecurringForMonth (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await clearRules();
  });
  afterEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await clearRules();
  });

  it('I-RV1 — uma ocorrência por regra ativa, com data clampada no mês alvo', async () => {
    const now = new Date();
    const { targetDate, ym } = nextMonth(now);

    await insertRule({ title: 'Salário', direction: 'income', amount_cents: 220000, day_of_month: 5 });
    await insertRule({ title: 'Assinatura', direction: 'expense', amount_cents: 1498, day_of_month: 10 });

    const supabase = await getAuthedClient();
    const occ = await listUngeneratedRecurringForMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetDate,
    });

    const byTitle = Object.fromEntries(occ.map((o) => [o.title, o]));
    expect(occ).toHaveLength(2);
    expect(byTitle['Salário']?.direction).toBe('income');
    expect(byTitle['Salário']?.amountCents).toBe(220000);
    expect(byTitle['Salário']?.occurredOn).toBe(`${ym}-05`);
    expect(byTitle['Assinatura']?.direction).toBe('expense');
    expect(byTitle['Assinatura']?.occurredOn).toBe(`${ym}-10`);
  });

  it('I-RV2 — exclui pausada, fora da janela e já gerada', async () => {
    const now = new Date();
    const { targetDate, ym } = nextMonth(now);

    const activeId = await insertRule({ title: 'Ativa', direction: 'expense', amount_cents: 1000, day_of_month: 8 });
    await insertRule({ title: 'Pausada', direction: 'expense', amount_cents: 1000, day_of_month: 8, is_paused: true });
    // active_from depois do fim do mês alvo → fora da janela
    const afterTarget = new Date(targetDate.getFullYear(), targetDate.getMonth() + 2, 1).toISOString().slice(0, 10);
    await insertRule({ title: 'Futura', direction: 'expense', amount_cents: 1000, day_of_month: 8, active_from: afterTarget });

    const generatedId = await insertRule({ title: 'JaGerada', direction: 'expense', amount_cents: 1000, day_of_month: 8 });
    const admin = getAdminClient();
    await admin.from('transactions').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_USER_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      category_id: SEED_CATEGORY_MERCADO_ID,
      direction: 'expense',
      amount_cents: 1000,
      currency: 'EUR',
      description: 'JaGerada',
      occurred_on: `${ym}-08`,
      status: 'pending',
      source_recurring_rule_id: generatedId,
    });

    const supabase = await getAuthedClient();
    const occ = await listUngeneratedRecurringForMonth({
      supabase,
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      targetDate,
    });

    expect(occ.map((o) => o.ruleId)).toEqual([activeId]);
  });
});
