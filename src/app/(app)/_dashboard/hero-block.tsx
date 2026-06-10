import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { HeroNumber, Num, type Currency } from '@/components/finance/num';
import { CCY } from '@/components/finance/ccy';
import { CurrencyToggle } from '@/components/finance/currency-toggle';
import { SobraPrevistaCard } from '@/components/finance/sobra-prevista-card';
import { StatTrio } from '@/components/finance/stat-trio';
import { convertCents } from '@/lib/fx';
import { sumEnvelopesByCurrency } from '@/lib/finance/envelopes';
import { getBalanceByAccountOn } from '@/lib/finance/balance-history';
import { projectMonth } from '@/lib/finance/month-projection';
import {
  getDashboardSupabase,
  getDashboardAccounts,
  getDashboardRateMap,
  getDashboardMonthStats,
  balanceByCurrency,
  hasBothCurrencies,
} from '@/lib/finance/dashboard-data';
import { MONTHS_PT_SHORT, endOfMonth, monthEyebrow } from '@/lib/dates';
import { formatRate } from '@/lib/money/format';

function endOfMonthLabel(d: Date): string {
  const last = endOfMonth(d);
  return `${String(last.getDate()).padStart(2, '0')} ${MONTHS_PT_SHORT[last.getMonth()]}`;
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

type Props = {
  nowIso: string;
  targetDateIso: string;
  isPast: boolean;
  isFuture: boolean;
};

const STATS_CURRENCY: Currency = 'EUR';

export async function HeroBlock({ nowIso, targetDateIso, isPast, isFuture }: Props) {
  const session = await getSession();
  const now = new Date(nowIso);
  const targetDate = new Date(targetDateIso);

  const accounts = await getDashboardAccounts(session.householdId);
  if (accounts.length === 0) {
    return <EmptyHero />;
  }

  const balByCcy = balanceByCurrency(accounts);
  const both = hasBothCurrencies(accounts);
  const rateMap = both ? await getDashboardRateMap(nowIso) : null;

  const displayCurrency = session.preferredDisplayCurrency;
  const otherCurrency: Currency = displayCurrency === 'EUR' ? 'BRL' : 'EUR';

  const totalInDisplay = rateMap
    ? balByCcy[displayCurrency] +
      convertCents(
        balByCcy[otherCurrency],
        displayCurrency === 'EUR' ? rateMap.BRL_EUR : rateMap.EUR_BRL,
      )
    : balByCcy[displayCurrency];

  const stats = await getDashboardMonthStats(
    session.householdId,
    STATS_CURRENCY,
    balByCcy[STATS_CURRENCY],
    targetDateIso,
    nowIso,
  );

  if (isPast) {
    const supabase = await getDashboardSupabase();
    const accountsStats = accounts.filter((a) => a.currency === STATS_CURRENCY);
    const historicalLookup = await getBalanceByAccountOn(
      supabase,
      accountsStats.map((a) => ({ id: a.id, balance_cents: a.balance_cents })),
      targetDate,
    );
    const historicalBalanceCents = Object.values(historicalLookup).reduce(
      (sum, l) => sum + l.cents,
      0,
    );
    const historicalAllFromSnapshot =
      accountsStats.length > 0 &&
      accountsStats.every((a) => historicalLookup[a.id]?.source === 'snapshot');

    const monthFlowNetCents = stats.incomePaid.totalCents - stats.paid.totalCents;
    const heroCents = historicalAllFromSnapshot
      ? historicalBalanceCents
      : monthFlowNetCents;

    return (
      <div className="space-y-6">
        <section className="rounded-md border border-border-soft bg-bg-surface p-5 lg:p-6 space-y-3">
          <p className="text-[15px] text-fg3">
            {historicalAllFromSnapshot
              ? `Saldo em ${monthEyebrow(targetDate)}`
              : `Resumo de ${monthEyebrow(targetDate)}`}
          </p>
          <HeroNumber cents={heroCents} currency={STATS_CURRENCY} />
          {!historicalAllFromSnapshot && (
            <p className="text-[11px] text-fg4">
              estimado a partir do fluxo — snapshot ainda não capturado pra essa data
            </p>
          )}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <FlowStat label="Recebido" cents={stats.incomePaid.totalCents} currency={STATS_CURRENCY} tone="positive" />
            <FlowStat label="Gasto" cents={stats.paid.totalCents} currency={STATS_CURRENCY} tone="negative" />
            <FlowStat label="Sobra" cents={monthFlowNetCents} currency={STATS_CURRENCY} tone={monthFlowNetCents >= 0 ? 'positive' : 'negative'} />
          </div>
        </section>
        <StatTrio stats={stats} currency={STATS_CURRENCY} />
      </div>
    );
  }

  const envelopeAllocations = await sumEnvelopesByCurrency(
    await getDashboardSupabase(),
    session.householdId,
  );
  const totalAllocatedCents =
    envelopeAllocations.EUR + envelopeAllocations.BRL;
  const allocatedInDisplay = rateMap
    ? envelopeAllocations[displayCurrency] +
      convertCents(
        envelopeAllocations[otherCurrency],
        displayCurrency === 'EUR' ? rateMap.BRL_EUR : rateMap.EUR_BRL,
      )
    : envelopeAllocations[displayCurrency];
  const freeInDisplay = totalInDisplay - allocatedInDisplay;

  const accountsTotalInStatsCcy = rateMap
    ? balByCcy.EUR + convertCents(balByCcy.BRL, rateMap.BRL_EUR)
    : balByCcy.EUR;

  // Projeção pro mês corrente e futuro: saldo + pending real + recorrente
  // virtual (não gerada). No corrente, captura recorrentes que o cron ainda
  // não materializou (ex: salário do dia 5 quando estamos no dia 2).
  const projection = await projectMonth({
    supabase: await getDashboardSupabase(),
    householdId: session.householdId,
    targetCurrency: STATS_CURRENCY,
    fxRateMap: rateMap,
    accountsTotalInTargetCents: accountsTotalInStatsCcy,
    targetDate,
    now,
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="rounded-md border border-border-soft bg-bg-surface p-5 lg:p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] text-fg3">
              {both && rateMap ? 'Saldo total' : 'Saldo atual'}
            </p>
            {both && <CurrencyToggle current={displayCurrency} />}
          </div>
          <HeroNumber cents={totalInDisplay} currency={displayCurrency} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CCY code="EUR" />
            <Num cents={balByCcy.EUR} currency="EUR" className="text-[11px] text-fg3" />
            <span className="text-fg5">·</span>
            <CCY code="BRL" />
            <Num cents={balByCcy.BRL} currency="BRL" className="text-[11px] text-fg3" />
            {rateMap ? (
              <span className="ml-auto mono text-[10px] text-fg4">
                1 € = R$ {formatRate(rateMap.EUR_BRL)} · {shortDate(rateMap.rateDate)}
                {rateMap.isStale && ' (desatualizada)'}
              </span>
            ) : both ? (
              <span className="ml-auto mono text-[10px] uppercase tracking-wider text-status-overdue-fg bg-status-overdue-bg rounded-xs px-1.5 py-0.5">
                Câmbio indisponível
              </span>
            ) : null}
          </div>
          {totalAllocatedCents > 0 && (
            <div className="flex items-baseline justify-between gap-2 border-t border-border-soft pt-3 text-[12px]">
              <span className="text-fg3">Livre (fora das caixinhas)</span>
              <Num
                cents={freeInDisplay}
                currency={displayCurrency}
                className={
                  freeInDisplay < 0
                    ? 'text-[14px] font-semibold text-money-negative'
                    : 'text-[14px] font-semibold text-fg1'
                }
              />
            </div>
          )}
        </div>
        <SobraPrevistaCard
          stats={stats}
          statsCurrency={STATS_CURRENCY}
          displayCurrency={displayCurrency}
          endOfMonthLabel={endOfMonthLabel(isFuture ? targetDate : now)}
          fxRateMap={rateMap ? { EUR_BRL: rateMap.EUR_BRL, BRL_EUR: rateMap.BRL_EUR } : null}
          showToggle={both && rateMap !== null}
          future={isFuture}
          projected={{
            sobraCents: projection.sobraProjetadaCents,
            recurringExpenseCents: projection.recurringPendingExpenseCents,
            pendingExpenseCents: projection.stats.pendingExpenseCents,
          }}
        />
      </section>
      <StatTrio stats={stats} currency={STATS_CURRENCY} />
    </div>
  );
}

function FlowStat({
  label,
  cents,
  currency,
  tone,
}: {
  label: string;
  cents: number;
  currency: Currency;
  tone: 'positive' | 'negative';
}) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-inset p-3 space-y-1">
      <p className="eyebrow">{label}</p>
      <Num
        cents={cents}
        currency={currency}
        className={tone === 'positive' ? 'num--stat text-money-positive' : 'num--stat text-money-negative'}
      />
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-border-soft bg-bg-surface p-8 text-center">
      <div className="space-y-2">
        <h2>Sem transações ainda.</h2>
        <p className="text-sm text-fg3">
          O dashboard ganha vida quando há movimentação.
        </p>
      </div>
      <Link
        href="/lancar"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cf-press"
      >
        <Plus className="size-4" strokeWidth={1.6} aria-hidden />
        Lançar primeira despesa
      </Link>
    </div>
  );
}
