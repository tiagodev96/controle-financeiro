'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/lib/finance/balance-trend';
import type { Currency } from '@/components/finance/num';
import { formatCents as formatMoney } from '@/lib/money/format';
import {
  TooltipShell,
  chartAxisLineProps,
  chartCursorProps,
  chartGridProps,
  chartTickProps,
  formatDayShort,
  moneyTickFormatter,
} from '@/components/finance/charts/chart-primitives';

type Props = {
  series: { EUR: TrendPoint[]; BRL: TrendPoint[] };
  defaultCurrency: Currency;
};

type RechartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: TrendPoint }>;
};

function ChartTooltip({
  active,
  payload,
  currency,
}: RechartTooltipProps & { currency: Currency }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipShell>
      <p className="mono text-[10px] uppercase tracking-wider text-fg4">{formatDayShort(point.date)}</p>
      <p className="num text-[14px] font-semibold text-fg1">{formatMoney(point.totalCents, currency)}</p>
      {point.accountsCount > 1 && (
        <p className="text-[10px] text-fg4">{point.accountsCount} contas</p>
      )}
    </TooltipShell>
  );
}

export function BalanceTrendChart({ series, defaultCurrency }: Props) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const data = series[currency];
  const hasData = data.length >= 2;
  const other: Currency = currency === 'EUR' ? 'BRL' : 'EUR';
  const otherHasData = series[other].length >= 2;

  return (
    <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="eyebrow">Evolução do saldo</p>
          <p className="text-[11px] text-fg4">últimas 26 semanas · snapshots {currency}</p>
        </div>
        {otherHasData && (
          <button
            type="button"
            onClick={() => setCurrency(other)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-bg-inset px-2 text-[11px] font-semibold uppercase tracking-wider text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden className="text-fg4">ver em</span>
            <span>{other}</span>
          </button>
        )}
      </header>

      {!hasData ? (
        <div className="flex items-center justify-center rounded-md border border-dashed border-border-soft py-12 text-sm text-fg4">
          {data.length === 0
            ? 'Sem snapshots ainda. Cron captura todo domingo, ou adicione manualmente.'
            : 'Pelo menos 2 snapshots pra traçar a linha. Aguarde mais alguns ciclos.'}
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayShort}
                stroke="var(--color-fg4)"
                tick={chartTickProps}
                tickLine={false}
                axisLine={chartAxisLineProps}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={moneyTickFormatter(currency)}
                stroke="var(--color-fg4)"
                tick={chartTickProps}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                content={(p: RechartTooltipProps) => <ChartTooltip {...p} currency={currency} />}
                cursor={chartCursorProps}
              />
              <Line
                type="monotone"
                dataKey="totalCents"
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--color-brand)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--color-brand)', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
