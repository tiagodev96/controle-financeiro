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

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function monthEyebrow(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]} · ${d.getFullYear()}`;
}

type SearchParams = Promise<{ mes?: string }>;

function parseMonthParam(raw: string | undefined, now: Date): {
  targetDate: Date;
  monthIso: string;
  isPast: boolean;
  isFuture: boolean;
} {
  const currentIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const match = raw && /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  const monthIso = `${y}-${String(m).padStart(2, '0')}`;
  if (monthIso === currentIso) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  const targetDate = new Date(y, m, 0);
  return {
    targetDate,
    monthIso,
    isPast: monthIso < currentIso,
    isFuture: monthIso > currentIso,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = new Date();
  const params = await searchParams;
  const { targetDate, monthIso, isPast, isFuture } = parseMonthParam(params.mes, now);
  const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
