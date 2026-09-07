'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { InvoiceChartMonth } from '@/lib/finance/invoice-chart';
import type { Currency } from '@/components/finance/num';
import { formatCents } from '@/lib/money/format';
import {
  TooltipShell,
  chartAxisLineProps,
  chartGridProps,
  chartTickProps,
  formatMonthShort,
  moneyTickFormatter,
} from './chart-primitives';

const FILL_BY_STATE: Record<InvoiceChartMonth['state'], string> = {
  past: 'var(--color-fg4)',
  open: 'var(--color-brand)',
  future: 'var(--color-status-pending-fg)',
};

const STATE_LABEL: Record<InvoiceChartMonth['state'], string> = {
  past: 'passada',
  open: 'aberta',
  future: 'futura',
};

type Props = {
  months: InvoiceChartMonth[];
  currency: Currency;
};

type RechartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: InvoiceChartMonth }>;
};

function ChartTooltip({ active, payload, currency }: RechartTooltipProps & { currency: Currency }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipShell>
      <p className="mono text-[10px] uppercase tracking-wider text-fg4">
        {formatMonthShort(point.monthIso)} · {STATE_LABEL[point.state]}
      </p>
      <p className="num text-[14px] font-semibold text-fg1">
        {formatCents(point.totalCents, currency)}
      </p>
    </TooltipShell>
  );
}

export function InvoiceBarChart({ months, currency }: Props) {
  return (
    <div data-testid="invoice-bar-chart" className="space-y-1.5">
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis
              dataKey="monthIso"
              tickFormatter={formatMonthShort}
              stroke="var(--color-fg4)"
              tick={chartTickProps}
              tickLine={false}
              axisLine={chartAxisLineProps}
            />
            <YAxis
              tickFormatter={moneyTickFormatter(currency)}
              stroke="var(--color-fg4)"
              tick={chartTickProps}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              content={(p: RechartTooltipProps) => <ChartTooltip {...p} currency={currency} />}
              cursor={{ fill: 'var(--color-bg-inset)' }}
            />
            <Bar dataKey="totalCents" radius={[3, 3, 0, 0]} maxBarSize={36}>
              {months.map((m) => (
                <Cell key={m.monthIso} fill={FILL_BY_STATE[m.state]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mono px-1 text-[10px] text-fg4">
        <span style={{ color: 'var(--color-fg4)' }}>■</span> passadas{' '}
        <span style={{ color: 'var(--color-brand)' }}>■</span> aberta{' '}
        <span style={{ color: 'var(--color-status-pending-fg)' }}>■</span> futuras
      </p>
    </div>
  );
}
