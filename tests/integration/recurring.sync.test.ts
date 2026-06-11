import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRecurringCore, updateRecurringCore } from '@/server/actions/recurring/core';
import { generateRecurringForMonthCore } from '@/server/actions/recurring/generate-core';
import { monthIso } from '@/lib/dates';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

const MONTH_ISO = monthIso(new Date());

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'RSYNC test %');
}

async function createAndGenerate(): Promise<string> {
  const supabase = await getAuthedClient();
  const created = await createRecurringCore(
    { supabase, session: SEED_SESSION },
    {
      title: 'RSYNC test assinatura',
      amountCents: 5_000,
      direction: 'expense',
      categoryId: SEED_CATEGORY_MERCADO_ID,
      accountId: SEED_ACCOUNT_EUR_ID,
      dayOfMonth: 10,
      notes: null,
    },
  );
  if (!created.ok) throw new Error('setup create');
  const generated = await generateRecurringForMonthCore(
    { supabase, session: SEED_SESSION },
    { monthIso: MONTH_ISO },
  );
  if (!generated.ok || generated.created !== 1) throw new Error('setup generate');
  return created.rule.id;
}

describe('updateRecurringCore — sync da pendente do mês corrente (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-RSYNC1 — editar valor e dia da regra atualiza a transaction pendente já gerada no mês', async () => {
    const ruleId = await createAndGenerate();

    const supabase = await getAuthedClient();
    const updated = await updateRecurringCore(
      { supabase, session: SEED_SESSION },
      { ruleId, patch: { amountCents: 11_000, dayOfMonth: 20 } },
    );
    expect(updated.ok).toBe(true);

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select('amount_cents, occurred_on, status')
      .eq('source_recurring_rule_id', ruleId);

    expect(txns).toHaveLength(1);
    expect(txns?.[0]).toMatchObject({
      status: 'pending',
      amount_cents: 11_000,
      occurred_on: `${MONTH_ISO}-20`,
    });
  });

  it('I-RSYNC2 — transaction já paga não é tocada pela edição da regra', async () => {
    const ruleId = await createAndGenerate();

    const admin = getAdminClient();
    const { error: payError } = await admin
      .from('transactions')
      .update({ status: 'paid', paid_on: `${MONTH_ISO}-10` })
      .eq('source_recurring_rule_id', ruleId);
    if (payError) throw new Error(`setup pay: ${payError.message}`);

    const supabase = await getAuthedClient();
    const updated = await updateRecurringCore(
      { supabase, session: SEED_SESSION },
      { ruleId, patch: { amountCents: 11_000, dayOfMonth: 20 } },
    );
    expect(updated.ok).toBe(true);

    const { data: txns } = await admin
      .from('transactions')
      .select('amount_cents, occurred_on')
      .eq('source_recurring_rule_id', ruleId);

    expect(txns).toHaveLength(1);
    expect(txns?.[0]).toMatchObject({
      amount_cents: 5_000,
      occurred_on: `${MONTH_ISO}-10`,
    });
  });
});
