import { getSession } from '@/lib/auth/session';
import { Num, type Currency } from '@/components/finance/num';
import { DebtSuggestionCard } from '@/components/finance/debt-suggestion-card';
import { CategoryLimitsCard } from '@/components/finance/category-limits-card';
import { computeDebtSuggestion } from '@/lib/finance/debt-suggestion';
import { listUpcomingPending } from '@/lib/finance/upcoming';
import { listCategoriesWithLimits } from '@/lib/finance/category-limits';
import {
  getDashboardSupabase,
  getDashboardAccounts,
  getDashboardRateMap,
  getDashboardMonthStats,
  getDashboardDebts,
  balanceByCurrency,
  hasBothCurrencies,
} from '@/lib/finance/dashboard-data';

type Props = {
  nowIso: string;
  targetDateIso: string;
};

const STATS_CURRENCY: Currency = 'EUR';

export async function InsightsBlock({ nowIso, targetDateIso }: Props) {
  const session = await getSession();
  const accounts = await getDashboardAccounts(session.householdId);
  if (accounts.length === 0) return null;

  const both = hasBothCurrencies(accounts);
  const rateMap = both ? await getDashboardRateMap(nowIso) : null;
  const balByCcy = balanceByCurrency(accounts);

  const [stats, debts, upcoming, categoryLimits] = await Promise.all([
    getDashboardMonthStats(
      session.householdId,
      STATS_CURRENCY,
      balByCcy[STATS_CURRENCY],
      targetDateIso,
    ),
    getDashboardDebts(session.householdId),
    listUpcomingPending(
      await getDashboardSupabase(),
      session.householdId,
      new Date(nowIso),
      7,
    ),
    listCategoriesWithLimits(
      await getDashboardSupabase(),
      session.householdId,
      rateMap,
      new Date(targetDateIso),
    ),
  ]);

  const suggestion = computeDebtSuggestion({
    sobraEurCents: stats.sobraPrevistaCents,
    openDebts: debts.open.map((d) => ({
      id: d.id,
      title: d.title,
      currency: d.currency,
      priority: d.priority,
      remainingCents: d.remaining_amount_cents,
    })),
    fxRateMap: rateMap
      ? { EUR_BRL: rateMap.EUR_BRL, BRL_EUR: rateMap.BRL_EUR }
      : null,
  });

  const suggestionAccounts = accounts
    .filter((a) => suggestion && a.currency === suggestion.debt.currency)
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  const now = new Date(nowIso);

  return (
    <>
      {suggestion && (
        <DebtSuggestionCard
          debtId={suggestion.debt.id}
          debtTitle={suggestion.debt.title}
          debtCurrency={suggestion.debt.currency}
          debtRemainingCents={suggestion.debt.remainingCents}
          suggestedCents={suggestion.suggestedCents}
          percOfDebt={suggestion.percOfDebt}
          sobraEurCents={stats.sobraPrevistaCents}
          accounts={suggestionAccounts}
        />
      )}

      {categoryLimits.length > 0 && (
        <CategoryLimitsCard limits={categoryLimits} />
      )}

      {upcoming.length > 0 && (
        <section className="space-y-2">
          <header className="flex items-baseline justify-between">
            <h2>Próximos 7 dias</h2>
            <span className="mono text-[10px] text-fg4">
              {upcoming.length} venc.
            </span>
          </header>
          <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
            {upcoming.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 py-2.5 text-[14px]"
              >
                <span className="mono inline-flex w-12 shrink-0 text-[10px] text-fg4">
                  {shortDayLabel(u.occurred_on, now)}
                </span>
                <span className="min-w-0 flex-1 truncate text-fg2">
                  {u.description}
                </span>
                <Num
                  cents={u.amount_cents}
                  currency={u.currency}
                  className={
                    u.direction === 'income'
                      ? 'shrink-0 font-semibold text-money-positive'
                      : 'shrink-0 font-semibold text-money-negative'
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function shortDayLabel(iso: string, now: Date): string {
  const today = now.toISOString().slice(0, 10);
  if (iso === today) return 'hoje';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === tomorrow.toISOString().slice(0, 10)) return 'amanhã';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
