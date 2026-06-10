import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession } from '@/lib/auth/session';
import { getRateMapSafe } from '@/lib/fx';
import { loadCategoryTrend, loadMonthlyFlow } from '@/lib/finance/category-trend';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { CategoryTrendChart } from '@/components/finance/charts/category-trend-chart';
import { MonthlyFlowChart } from '@/components/finance/charts/monthly-flow-chart';

const MONTHS_COUNT = 6;

export default async function EvolucaoPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const now = new Date();
  const currency = session.preferredDisplayCurrency;

  const fxRateMap = await getRateMapSafe({
    supabase,
    serviceSupabase: getServiceRoleSupabase(),
    when: now,
  });

  const [trend, flow] = await Promise.all([
    loadCategoryTrend(supabase, session.householdId, {
      currency,
      fxRateMap,
      now,
      monthsCount: MONTHS_COUNT,
      topCount: 5,
    }),
    loadMonthlyFlow(supabase, session.householdId, {
      currency,
      fxRateMap,
      now,
      monthsCount: MONTHS_COUNT,
    }),
  ]);

  return (
    <section className="space-y-6 cf-fade-up">
      <AppTopBar eyebrow={`últimos ${MONTHS_COUNT} meses · ${currency}`} title="Evolução" />

      <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
        <div className="flex flex-col gap-0.5">
          <p className="eyebrow">Gastos por categoria</p>
          <p className="text-[11px] text-fg4">top 5 do período, mês a mês</p>
        </div>
        <CategoryTrendChart
          months={trend.months}
          series={trend.series}
          currency={currency}
          othersTotalCents={trend.othersTotalCents}
          fxIncomplete={trend.fxIncomplete}
        />
      </section>

      <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
        <div className="flex flex-col gap-0.5">
          <p className="eyebrow">Sobra mensal</p>
          <p className="text-[11px] text-fg4">entradas − despesas pagas, por mês</p>
        </div>
        <MonthlyFlowChart months={flow.months} currency={currency} fxIncomplete={flow.fxIncomplete} />
      </section>
    </section>
  );
}
