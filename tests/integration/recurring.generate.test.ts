import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateRecurringForMonthCore } from '@/server/actions/recurring/generate-core';
import {
  getAuthedClient,
  SEED_TIAGO_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
  SEED_CATEGORY_RESTAURANTE_ID,
} from './helpers/auth';
import {
  getAdminClient,
  truncateHouseholdTransactions,
} from './helpers/db';

async function cleanupRecurring(): Promise<void> {
  const admin = getAdminClient();
  await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'GEN test %');
}

async function seedRule(overrides: {
  title: string;
  is_paused?: boolean;
  active_until?: string | null;
  category_id?: string;
}): Promise<string> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from('recurring_rules')
    .insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      title: overrides.title,
      amount_cents: 5000,
      direction: 'expense',
      currency: 'EUR',
      category_id: overrides.category_id ?? SEED_CATEGORY_MERCADO_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      day_of_month: 10,
      frequency: 'monthly',
      is_paused: overrides.is_paused ?? false,
      active_until: overrides.active_until ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`seedRule: ${error?.message}`);
  return data.id;
}

const NOW = new Date();
const MONTH_ISO = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}`;

describe('generateRecurringForMonthCore (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
    await cleanupRecurring();
  });
  afterEach(cleanupRecurring);

  it('I-GEN1 — gera 1 transaction pending por regra ativa do mês', async () => {
    const rule1 = await seedRule({ title: 'GEN test aluguel' });
    const rule2 = await seedRule({ title: 'GEN test nos' });

    const supabase = await getAuthedClient();
    const result = await generateRecurringForMonthCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { monthIso: MONTH_ISO },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);

    const admin = getAdminClient();
    const { data } = await admin
      .from('transactions')
      .select('source_recurring_rule_id, status, amount_cents')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .in('source_recurring_rule_id', [rule1, rule2]);

    expect(data).toHaveLength(2);
    expect(data?.every((t) => t.status === 'pending')).toBe(true);
    expect(data?.every((t) => t.amount_cents === 5000)).toBe(true);
  });

  it('I-GEN2 — gerar 2x não duplica (idempotente)', async () => {
    await seedRule({ title: 'GEN test idem' });
    const supabase = await getAuthedClient();
    const first = await generateRecurringForMonthCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { monthIso: MONTH_ISO },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.created).toBe(1);

    const second = await generateRecurringForMonthCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { monthIso: MONTH_ISO },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
  });

  it('I-GEN3 — regra pausada e regra expirada (active_until passado) são ignoradas', async () => {
    await seedRule({ title: 'GEN test ativa' });
    await seedRule({ title: 'GEN test pausada', is_paused: true });
    await seedRule({
      title: 'GEN test expirada',
      active_until: '2024-01-01',
    });

    const supabase = await getAuthedClient();
    const result = await generateRecurringForMonthCore(
      { supabase, session: SEED_TIAGO_SESSION },
      { monthIso: MONTH_ISO },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(1);
  });
});

// Avoid unused-var noise
void SEED_CATEGORY_RESTAURANTE_ID;
