import { describe, it, expect } from 'vitest';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
} from './helpers/auth';
import { createIsolatedHousehold, deleteIsolatedHousehold } from './helpers/db';

describe('listAllAccountsForHousehold (integração)', () => {
  it('I-ACC1 — retorna as contas do household ordenadas por sort_order', async () => {
    const supabase = await getAuthedClient();
    const accounts = await listAllAccountsForHousehold(supabase, SEED_SESSION.householdId);

    const ids = accounts.map((a) => a.id);
    expect(ids).toContain(SEED_ACCOUNT_EUR_ID);
    expect(ids).toContain(SEED_ACCOUNT_BRL_ID);

    const sortOrders = accounts.map((a) => a.sort_order);
    expect(sortOrders).toEqual([...sortOrders].sort((a, b) => a - b));

    const eur = accounts.find((a) => a.id === SEED_ACCOUNT_EUR_ID);
    expect(eur).toMatchObject({ currency: 'EUR', is_archived: false });
    expect(typeof eur?.balance_cents).toBe('number');
  });

  it('I-ACC2 — household alheio vem vazio (RLS)', async () => {
    const isolated = await createIsolatedHousehold();
    try {
      const supabase = await getAuthedClient();
      const accounts = await listAllAccountsForHousehold(supabase, isolated.householdId);
      expect(accounts).toHaveLength(0);
    } finally {
      await deleteIsolatedHousehold(isolated.householdId);
    }
  });
});
