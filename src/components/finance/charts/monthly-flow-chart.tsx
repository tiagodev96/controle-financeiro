'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyFlowPoint } from '@/lib/finance/category-trend';
import type { Currency } from '@/components/finance/num';
import { formatCents } from '@/lib/money/format';
import {
  TooltipShell,
  chartAxisLineProps,
  chartCursorProps,
  chartGridProps,
  chartTickProps,
  formatMonthShort,
  moneyTickFormatter,
} from './chart-primitives';

type Props = {
  months: MonthlyFlowPoint[];
  currency: Currency;
  fxIncomplete: boolean;
};

type RechartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: MonthlyFlowPoint }>;
};

function ChartTooltip({ active, payload, currency }: RechartTooltipProps & { currency: Currency }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <TooltipShell>
      <p className="mono text-[10px] uppercase tracking-wider text-fg4">
        {formatMonthShort(point.monthIso)}
      </p>
      <p className="num text-[14px] font-semibold text-fg1">{formatCents(point.netCents, currency)}</p>
      <p className="text-[10px] text-fg4">
        entradas <span className="num text-money-positive">{formatCents(point.incomeCents, currency)}</span>
        {' · '}
        despesas <span className="num text-money-negative">{formatCents(point.expenseCents, currency)}</span>
      </p>
    </TooltipShell>
  );
}

export function MonthlyFlowChart({ months, currency, fxIncomplete }: Props) {
  const hasFlow = months.some((m) => m.incomeCents > 0 || m.expenseCents > 0);
  if (!hasFlow) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed border-border-soft py-12 text-sm text-fg4">
        Sem fluxo registrado no período ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={months} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
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
              width={64}
            />
            <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="2 2" />
            <Tooltip
              content={(p: RechartTooltipProps) => <ChartTooltip {...p} currency={currency} />}
              cursor={chartCursorProps}
            />
            <Line
              type="monotone"
              dataKey="netCents"
              stroke="var(--color-brand)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--color-brand)', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: 'var(--color-brand)', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {fxIncomplete && (
        <p className="px-1 text-[11px] text-fg4">câmbio indisponível — valores parciais</p>
      )}
    </div>
  );
}
