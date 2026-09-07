import { getSession } from '@/lib/auth/session';
import { CategoryProgressList } from '@/components/finance/category-progress';
import { topCategoriesCrossCurrency } from '@/lib/finance/dashboard-stats';
import {
  getDashboardSupabase,
  getDashboardAccounts,
  getDashboardRateMap,
  hasBothCurrencies,
} from '@/lib/finance/dashboard-data';
import { MONTHS_PT_SHORT } from '@/lib/dates';

type Props = {
  nowIso: string;
  targetDateIso: string;
};

export async function BottomBlock({ nowIso, targetDateIso }: Props) {
  const session = await getSession();
  const accounts = await getDashboardAccounts(session.householdId);
  if (accounts.length === 0) return null;

  const supabase = await getDashboardSupabase();
  const targetDate = new Date(targetDateIso);

  const displayCurrency = session.preferredDisplayCurrency;
  const both = hasBothCurrencies(accounts);
  const rateMap = both ? await getDashboardRateMap(nowIso) : null;

  const topCats = await topCategoriesCrossCurrency({
    supabase,
    householdId: session.householdId,
    displayCurrency,
    fxRateMap: rateMap,
    limit: 5,
    now: targetDate,
  });

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h2>Top categorias</h2>
        <span className="mono text-[10px] text-fg4">
          {topCats.fxIncomplete && <span className="mr-2">câmbio indisponível · parcial</span>}
          {MONTHS_PT_SHORT[targetDate.getMonth()]}
        </span>
      </header>
      <CategoryProgressList rows={topCats.rows} currency={displayCurrency} />
    </section>
  );
}
