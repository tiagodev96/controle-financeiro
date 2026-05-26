import { describe, it, expect, beforeEach } from 'vitest';
import { listTopCategoriesForHousehold } from '@/lib/finance/categories';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
  SEED_CATEGORY_RESTAURANTE_ID,
} from './helpers/auth';
import {
  getAdminClient,
  truncateHouseholdTransactions,
  createIsolatedHousehold,
  deleteIsolatedHousehold,
} from './helpers/db';

describe('listTopCategoriesForHousehold (integração)', () => {
  beforeEach(async () => {
    await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I11 — ordena por uso desc; categorias sem uso vêm depois por sort_order', async () => {
    const admin = getAdminClient();
    const baseTx = {
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_SESSION.userId,
      account_id: SEED_ACCOUNT_EUR_ID,
      direction: 'expense' as const,
      amount_cents: 100,
      currency: 'EUR' as const,
      description: 'seed',
      occurred_on: '2026-05-01',
      status: 'pending' as const,
    };
    const { error: insError } = await admin.from('transactions').insert([
      { ...baseTx, category_id: SEED_CATEGORY_RESTAURANTE_ID },
      { ...baseTx, category_id: SEED_CATEGORY_RESTAURANTE_ID, occurred_on: '2026-05-02' },
      { ...baseTx, category_id: SEED_CATEGORY_RESTAURANTE_ID, occurred_on: '2026-05-03' },
      { ...baseTx, category_id: SEED_CATEGORY_MERCADO_ID, occurred_on: '2026-05-04' },
    ]);
    expect(insError).toBeNull();

    const supabase = await getAuthedClient();
    const ranking = await listTopCategoriesForHousehold(
      supabase,
      SEED_DEMO_HOUSEHOLD_ID,
      6
    );

    expect(ranking).toHaveLength(6);
    expect(ranking[0]?.name).toBe('Restaurante');
    expect(ranking[1]?.name).toBe('Mercado');
    expect(ranking.slice(2).map((c) => c.name)).toEqual([
      'Transporte',
      'Moradia',
      'Lazer',
      'Outros',
    ]);
  });

  it('I11b — respeita o limite passado', async () => {
    const supabase = await getAuthedClient();
    const ranking = await listTopCategoriesForHousehold(
      supabase,
      SEED_DEMO_HOUSEHOLD_ID,
      3
    );
    expect(ranking).toHaveLength(3);
  });

  it('I-IN2 — kind=income retorna só categorias income do seed (Salário, Freela, Outras entradas)', async () => {
    const supabase = await getAuthedClient();
    const ranking = await listTopCategoriesForHousehold(
      supabase,
      SEED_DEMO_HOUSEHOLD_ID,
      6,
      { kind: 'income' },
    );
    expect(ranking.map((c) => c.name).sort()).toEqual([
      'Freela',
      'Outras entradas',
      'Salário',
    ]);
  });

  it('I-IN3 — kind=expense (default) não retorna categorias income (regressão)', async () => {
    const supabase = await getAuthedClient();
    const ranking = await listTopCategoriesForHousehold(
      supabase,
      SEED_DEMO_HOUSEHOLD_ID,
      6,
    );
    expect(ranking.map((c) => c.name)).not.toContain('Salário');
    expect(ranking.map((c) => c.name)).not.toContain('Freela');
  });

  it('I12 — retorna lista vazia quando household não tem categorias', async () => {
    const isolated = await createIsolatedHousehold();
    try {
      const admin = getAdminClient();
      const { error: delError } = await admin
        .from('categories')
        .delete()
        .eq('id', isolated.categoryId);
      expect(delError).toBeNull();

      const supabase = await getAuthedClient();
      const ranking = await listTopCategoriesForHousehold(
        supabase,
        isolated.householdId,
        6
      );
      expect(ranking).toEqual([]);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });
});
