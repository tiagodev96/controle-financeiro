import { getSession } from '@/lib/auth/session';
import { Num } from '@/components/finance/num';
import { CategoryLimitsCard } from '@/components/finance/category-limits-card';
import {
  daysUntil,
  monthsUntil,
  requiredMonthlyCents,
  formatDeadlineMonth,
} from '@/lib/finance/debt-deadline';
import {
  DebtDeadlinesCard,
  type DeadlineCardItem,
} from '@/components/finance/debt-deadlines-card';
import { listUpcomingPending } from '@/lib/finance/upcoming';
import { listCategoriesWithLimits } from '@/lib/finance/category-limits';
import {
  getDashboardSupabase,
  getDashboardAccounts,
  getDashboardRateMap,
  getDashboardDebts,
  hasBothCurrencies,
} from '@/lib/finance/dashboard-data';

type Props = {
  nowIso: string;
  targetDateIso: string;
};

const DEADLINE_HORIZON_DAYS = 60;

export async function InsightsBlock({ nowIso, targetDateIso }: Props) {
  const session = await getSession();
  const accounts = await getDashboardAccounts(session.householdId);
  if (accounts.length === 0) return null;

  const both = hasBothCurrencies(accounts);
  const rateMap = both ? await getDashboardRateMap(nowIso) : null;

  const supabase = await getDashboardSupabase();
  const now = new Date(nowIso);

  const [debts, upcoming, categoryLimits] = await Promise.all([
    getDashboardDebts(session.householdId),
    listUpcomingPending(supabase, session.householdId, now, 7),
    listCategoriesWithLimits(supabase, session.householdId, rateMap, new Date(targetDateIso)),
  ]);

  const todayIso = nowIso.slice(0, 10);
  const deadlineItems: DeadlineCardItem[] = debts.open
    .filter((d) => d.target_quit_date)
    .map((d) => ({ d, iso: d.target_quit_date!, days: daysUntil(d.target_quit_date!, todayIso) }))
    .filter(({ days }) => days <= DEADLINE_HORIZON_DAYS)
    .sort((a, b) => a.days - b.days)
    .map(({ d, iso, days }) => ({
      id: d.id,
      title: d.title,
      currency: d.currency,
      monthLabel: formatDeadlineMonth(iso),
      relativeLabel:
        days < 0
          ? `venceu há ${-days} dia${days === -1 ? '' : 's'}`
          : days === 0
            ? 'vence hoje'
            : `vence em ${days} dia${days === 1 ? '' : 's'}`,
      requiredCents: requiredMonthlyCents(d.remaining_amount_cents, monthsUntil(iso, todayIso)),
      overdue: days < 0,
    }));

  return (
    <>
      {categoryLimits.length > 0 && (
        <CategoryLimitsCard limits={categoryLimits} />
      )}

      <DebtDeadlinesCard items={deadlineItems} />

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
