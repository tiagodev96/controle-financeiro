import { Suspense } from 'react';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { DashboardMonthPicker } from '@/components/finance/dashboard-month-picker';
import {
  BalanceVisibilityProvider,
  BalanceVisibilityToggle,
} from '@/components/finance/balance-visibility';
import { HeroBlock } from './_dashboard/hero-block';
import { InsightsBlock } from './_dashboard/insights-block';
import { BottomBlock } from './_dashboard/bottom-block';
import { FxBlock } from './_dashboard/fx-block';
import {
  HeroBlockSkeleton,
  InsightsBlockSkeleton,
  BottomBlockSkeleton,
  FxBlockSkeleton,
} from './_dashboard/skeletons';
import { monthEyebrow, monthIso as toMonthIso, parseMonthParam } from '@/lib/dates';

type SearchParams = Promise<{ mes?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = new Date();
  const params = await searchParams;
  const { targetDate, monthIso, isPast, isFuture } = parseMonthParam(params.mes, now);
  const currentMonthIso = toMonthIso(now);

  const nowIso = now.toISOString();
  const targetDateIso = targetDate.toISOString();

  return (
    <BalanceVisibilityProvider>
      <section className="space-y-6 cf-fade-up">
        <AppTopBar
          eyebrow={isPast ? `visualizando ${monthEyebrow(targetDate)}` : monthEyebrow(now)}
          title="Dashboard"
          trailing={
            <>
              <BalanceVisibilityToggle />
              <DashboardMonthPicker value={monthIso} currentMonth={currentMonthIso} />
            </>
          }
        />

        <Suspense fallback={<HeroBlockSkeleton />}>
          <HeroBlock
            nowIso={nowIso}
            targetDateIso={targetDateIso}
            isPast={isPast}
            isFuture={isFuture}
          />
        </Suspense>

        {!isPast && (
          <Suspense fallback={<InsightsBlockSkeleton />}>
            <InsightsBlock nowIso={nowIso} targetDateIso={targetDateIso} />
          </Suspense>
        )}

        <Suspense fallback={<BottomBlockSkeleton />}>
          <BottomBlock nowIso={nowIso} targetDateIso={targetDateIso} isFuture={isFuture} />
        </Suspense>

        <Suspense fallback={<FxBlockSkeleton />}>
          <FxBlock nowIso={nowIso} />
        </Suspense>
      </section>
    </BalanceVisibilityProvider>
  );
}
