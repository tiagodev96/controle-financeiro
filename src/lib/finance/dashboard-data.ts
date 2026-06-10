import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getRateMapSafe, type RateMap } from '@/lib/fx';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import {
  calculateMonthStats,
  type MonthStats,
} from '@/lib/finance/dashboard-stats';
import { listDebtsForHousehold, type DebtRow } from '@/lib/finance/debts';

export type DashboardAccount = {
  id: string;
  name: string;
  currency: Currency;
  balance_cents: number;
};

export const getDashboardSupabase = cache(async () => {
  return getServerSupabase();
});

export const getDashboardAccounts = cache(
  async (_householdId: string): Promise<DashboardAccount[]> => {
    const supabase = await getDashboardSupabase();
    const res = await supabase
      .from('accounts')
      .select('id, name, currency, balance_cents')
      .eq('is_archived', false);
    return (res.data ?? []) as DashboardAccount[];
  },
);

export const getDashboardRateMap = cache(
  async (whenIso: string): Promise<RateMap | null> => {
    const supabase = await getDashboardSupabase();
    return getRateMapSafe({
      supabase: supabase as SupabaseClient<Database>,
      serviceSupabase: getServiceRoleSupabase(),
      when: new Date(whenIso),
    });
  },
);

export function balanceByCurrency(
  accounts: DashboardAccount[],
): Record<Currency, number> {
  return accounts.reduce<Record<Currency, number>>(
    (acc, a) => {
      acc[a.currency] = (acc[a.currency] ?? 0) + a.balance_cents;
      return acc;
    },
    { BRL: 0, EUR: 0 },
  );
}

export function hasBothCurrencies(accounts: DashboardAccount[]): boolean {
  return (
    accounts.some((a) => a.currency === 'EUR') &&
    accounts.some((a) => a.currency === 'BRL')
  );
}

export const getDashboardMonthStats = cache(
  async (
    householdId: string,
    currency: Currency,
    balanceCents: number,
    targetDateIso: string,
    nowIso: string,
  ): Promise<MonthStats> => {
    const supabase = await getDashboardSupabase();
    return calculateMonthStats(
      supabase as SupabaseClient<Database>,
      householdId,
      currency,
      balanceCents,
      new Date(targetDateIso),
      new Date(nowIso),
    );
  },
);

export const getDashboardDebts = cache(
  async (
    householdId: string,
  ): Promise<{ open: DebtRow[]; closed: DebtRow[] }> => {
    const supabase = await getDashboardSupabase();
    return listDebtsForHousehold(
      supabase as SupabaseClient<Database>,
      householdId,
    );
  },
);
