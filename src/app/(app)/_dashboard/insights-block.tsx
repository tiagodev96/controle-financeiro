import { getSession } from '@/lib/auth/session';
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

  const [debts, categoryLimits] = await Promise.all([
    getDashboardDebts(session.householdId),
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
    </>
  );
}

