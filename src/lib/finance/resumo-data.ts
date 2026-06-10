import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { convertCents, getRateMapSafe, type RateMap } from '@/lib/fx';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { listAllAccountsForHousehold, type AccountFull } from './accounts';
import {
  listDebtsForHousehold,
  sumDebtPaymentsThisMonth,
  debtsClosedInMonth,
  type DebtRow,
} from './debts';
import {
  calculateCrossCurrencyMonthStats,
  type CrossCurrencyMonthStats,
} from './cross-currency-stats';
import { projectMonth, type MonthProjection } from './month-projection';

export type ResumoDebtToShow = { debt: DebtRow; isClosed: boolean };

export type ResumoData = {
  /** Contas ativas (não-arquivadas). */
  accounts: AccountFull[];
  openDebts: DebtRow[];
  closedDebtsThisMonth: DebtRow[];
  /** Abertas primeiro, depois quitadas no mês alvo. */
  debtsToShow: ResumoDebtToShow[];
  debtPaymentsByDebtId: Record<string, number>;
  fxRateMap: RateMap | null;
  /** Soma das contas convertida pra `currency`; fxIncomplete quando alguma ficou fora por falta de fx. */
  accountsTotal: { cents: number; fxIncomplete: boolean };
  stats: CrossCurrencyMonthStats;
  /** Só pra mês futuro; null caso contrário. */
  projection: MonthProjection | null;
  hasData: boolean;
};

export type LoadResumoDataArgs = {
  supabase: SupabaseClient<Database>;
  householdId: string;
  currency: Currency;
  targetDate: Date;
  now: Date;
  isFuture: boolean;
  topCategoriesLimit: number;
};

/**
 * Carrega tudo que /resumo e a rota OG compartilham: contas, dívidas
 * (abertas + quitadas no mês), fx, stats cross-currency e projeção de mês
 * futuro. Os callers ficam só com apresentação e extras próprios (texto
 * WhatsApp, saldo histórico de snapshot).
 */
export async function loadResumoData(args: LoadResumoDataArgs): Promise<ResumoData> {
  const { supabase, householdId, currency, targetDate, now, isFuture, topCategoriesLimit } = args;

  const [accountsAll, { open: openDebts, closed: closedDebts }, debtPaymentsByDebtId] =
    await Promise.all([
      listAllAccountsForHousehold(supabase, householdId),
      listDebtsForHousehold(supabase, householdId),
      sumDebtPaymentsThisMonth(supabase, householdId, targetDate),
    ]);

  const closedDebtsThisMonth = debtsClosedInMonth(closedDebts, targetDate);
  const debtsToShow: ResumoDebtToShow[] = [
    ...openDebts.map((d) => ({ debt: d, isClosed: false })),
    ...closedDebtsThisMonth.map((d) => ({ debt: d, isClosed: true })),
  ];

  const fxRateMap = await getRateMapSafe({
    supabase,
    serviceSupabase: getServiceRoleSupabase(),
    when: now,
  });

  const accounts = accountsAll.filter((a) => !a.is_archived);

  let totalCents = 0;
  let totalFxIncomplete = false;
  for (const a of accounts) {
    if (a.currency === currency) {
      totalCents += a.balance_cents;
    } else if (fxRateMap) {
      const rate = currency === 'EUR' ? fxRateMap.BRL_EUR : fxRateMap.EUR_BRL;
      totalCents += convertCents(a.balance_cents, rate);
    } else {
      totalFxIncomplete = true;
    }
  }
  const accountsTotal = { cents: totalCents, fxIncomplete: totalFxIncomplete };

  const stats = await calculateCrossCurrencyMonthStats({
    supabase,
    householdId,
    targetCurrency: currency,
    fxRateMap,
    accountsTotalInTargetCents: accountsTotal.cents,
    targetDate,
    topCategoriesLimit,
  });

  const projection = isFuture
    ? await projectMonth({
        supabase,
        householdId,
        targetCurrency: currency,
        fxRateMap,
        accountsTotalInTargetCents: accountsTotal.cents,
        targetDate,
        now,
        topCategoriesLimit,
      })
    : null;

  const hasData =
    accounts.length > 0 ||
    debtsToShow.length > 0 ||
    stats.topCategories.length > 0 ||
    stats.paidExpenseCents > 0 ||
    stats.pendingExpenseCents > 0 ||
    (projection !== null && projection.expenseProjectedCents > 0);

  return {
    accounts,
    openDebts,
    closedDebtsThisMonth,
    debtsToShow,
    debtPaymentsByDebtId,
    fxRateMap,
    accountsTotal,
    stats,
    projection,
    hasData,
  };
}
