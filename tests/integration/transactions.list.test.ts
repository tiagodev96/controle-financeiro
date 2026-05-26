import { describe, it, expect, beforeEach } from 'vitest';
import { listTransactionsForHousehold } from '@/lib/finance/transactions';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
  SEED_CATEGORY_RESTAURANTE_ID,
} from './helpers/auth';
import { truncateHouseholdTransactions, getAdminClient } from './helpers/db';

const TODAY = new Date().toISOString().slice(0, 10);

type TxnSeed = {
  id?: string;
  amount_cents: number;
  description: string;
  category_id?: string;
  account_id?: string;
  currency?: 'EUR' | 'BRL';
  direction?: 'expense' | 'income';
  status?: 'pending' | 'paid';
  occurred_on?: string;
  paid_on?: string | null;
};

async function seedTxns(rows: TxnSeed[]): Promise<void> {
  const admin = getAdminClient();
  const payload = rows.map((r) => ({
    household_id: SEED_DEMO_HOUSEHOLD_ID,
    profile_id: SEED_SESSION.userId,
    amount_cents: r.amount_cents,
    description: r.description,
    category_id: r.category_id ?? SEED_CATEGORY_MERCADO_ID,
    account_id: r.account_id ?? SEED_ACCOUNT_EUR_ID,
    currency: r.currency ?? 'EUR',
    direction: r.direction ?? 'expense',
    status: r.status ?? 'pending',
    occurred_on: r.occurred_on ?? TODAY,
    paid_on: r.paid_on ?? (r.status === 'paid' ? TODAY : null),
  }));
  const { error } = await admin.from('transactions').insert(payload);
  if (error) throw new Error(`seedTxns failed: ${error.message}`);
}

describe('listTransactionsForHousehold (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-T1 — retorna do household correto, ordem occurred_on desc', async () => {
    await seedTxns([
      { description: 'mais antiga', occurred_on: '2026-05-01', amount_cents: 100 },
      { description: 'mais nova', occurred_on: '2026-05-20', amount_cents: 200 },
      { description: 'meio', occurred_on: '2026-05-10', amount_cents: 150 },
    ]);

    const supabase = await getAuthedClient();
    const result = await listTransactionsForHousehold(supabase, {
      householdId: SEED_DEMO_HOUSEHOLD_ID,
    });

    expect(result.transactions.map((t) => t.description)).toEqual([
      'mais nova',
      'meio',
      'mais antiga',
    ]);
    expect(result.total).toBe(3);
  });

  it('I-T2 — filtro status pending / paid / todos', async () => {
    await seedTxns([
      { description: 'pendente A', status: 'pending', amount_cents: 100 },
      { description: 'pago A', status: 'paid', amount_cents: 200 },
      { description: 'pendente B', status: 'pending', amount_cents: 300 },
    ]);

    const supabase = await getAuthedClient();

    const pending = await listTransactionsForHousehold(supabase, {
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      status: 'pending',
    });
    expect(pending.transactions.map((t) => t.description).sort()).toEqual([
      'pendente A',
      'pendente B',
    ]);

    const paid = await listTransactionsForHousehold(supabase, {
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      status: 'paid',
    });
    expect(paid.transactions.map((t) => t.description)).toEqual(['pago A']);

    const all = await listTransactionsForHousehold(supabase, {
      householdId: SEED_DEMO_HOUSEHOLD_ID,
    });
    expect(all.transactions).toHaveLength(3);
  });

  it('I-T3 — filtro accountId', async () => {
    await seedTxns([
      { description: 'EUR a', account_id: SEED_ACCOUNT_EUR_ID, currency: 'EUR', amount_cents: 100 },
      { description: 'BRL a', account_id: SEED_ACCOUNT_BRL_ID, currency: 'BRL', amount_cents: 200 },
      { description: 'EUR b', account_id: SEED_ACCOUNT_EUR_ID, currency: 'EUR', amount_cents: 300 },
    ]);

    const supabase = await getAuthedClient();
    const eurOnly = await listTransactionsForHousehold(supabase, {
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      accountId: SEED_ACCOUNT_EUR_ID,
    });

    expect(eurOnly.transactions.map((t) => t.description).sort()).toEqual(['EUR a', 'EUR b']);
  });

  it('I-T4 — filtro monthIso pega só transações com occurred_on no mês', async () => {
    await seedTxns([
      { description: 'abr', occurred_on: '2026-04-25', amount_cents: 100 },
      { description: 'mai 01', occurred_on: '2026-05-01', amount_cents: 200 },
      { description: 'mai 31', occurred_on: '2026-05-31', amount_cents: 300 },
      { description: 'jun', occurred_on: '2026-06-01', amount_cents: 400 },
    ]);

    const supabase = await getAuthedClient();
    const may = await listTransactionsForHousehold(supabase, {
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      monthIso: '2026-05',
    });

    expect(may.transactions.map((t) => t.description).sort()).toEqual(['mai 01', 'mai 31']);
  });

  it('I-T5 — limit corta o array mas total reflete a contagem real', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      description: `t${i}`,
      amount_cents: 100 + i,
      occurred_on: `2026-05-${String(10 + i).padStart(2, '0')}`,
    }));
    await seedTxns(many);

    const supabase = await getAuthedClient();
    const result = await listTransactionsForHousehold(supabase, {
      householdId: SEED_DEMO_HOUSEHOLD_ID,
      limit: 3,
    });

    expect(result.transactions).toHaveLength(3);
    expect(result.total).toBe(5);
    // mantém ordem desc nas 3 primeiras
    expect(result.transactions[0]?.description).toBe('t4');
  });
});

// Avoid unused-var warning if seed const not referenced
void SEED_CATEGORY_RESTAURANTE_ID;
