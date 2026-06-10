'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CategoryTrendSeries } from '@/lib/finance/category-trend';
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
  months: string[];
  series: CategoryTrendSeries[];
  currency: Currency;
  othersTotalCents: number;
  fxIncomplete: boolean;
};

// Acento único de brand + neutros/amber — verde e clay são reservados pra
// entrada/despesa e não entram em paleta categórica.
const LINE_COLORS = [
  'var(--color-brand)',
  'var(--color-fg2)',
  'var(--color-status-pending-fg)',
  'var(--color-brand-quiet-fg)',
  'var(--color-fg4)',
] as const;

type ChartRow = Record<string, number | string>;

type RechartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: number | string | ReadonlyArray<number | string>;
    color?: string;
  }>;
};

function scalarValue(value: number | string | ReadonlyArray<number | string> | undefined): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

function ChartTooltip({ active, label, payload, currency }: RechartTooltipProps & { currency: Currency }) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipShell>
      <p className="mono text-[10px] uppercase tracking-wider text-fg4">
        {formatMonthShort(String(label))}
      </p>
      {payload.map((entry) => (
        <p key={String(entry.name)} className="num text-[12px] text-fg1">
          <span aria-hidden className="mr-1" style={{ color: entry.color }}>
            ●
          </span>
          {entry.name}: {formatCents(scalarValue(entry.value), currency)}
        </p>
      ))}
    </TooltipShell>
  );
}

export function CategoryTrendChart({ months, series, currency, othersTotalCents, fxIncomplete }: Props) {
  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed border-border-soft py-12 text-sm text-fg4">
        Sem despesas no período ainda.
      </div>
    );
  }

  const data: ChartRow[] = months.map((ym) => {
    const row: ChartRow = { monthIso: ym };
    for (const s of series) {
      row[s.name] = s.points.find((p) => p.monthIso === ym)?.totalCents ?? 0;
    }
    return row;
  });

  return (
    <div className="space-y-3">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
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
            <Tooltip
              content={(p: RechartTooltipProps) => <ChartTooltip {...p} currency={currency} />}
              cursor={chartCursorProps}
            />
            {series.map((s, idx) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.name}
                stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                strokeWidth={idx === 0 ? 2 : 1.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1">
        {series.map((s, idx) => (
          <li key={s.id} className="flex items-center gap-1.5 text-[11px] text-fg3">
            <span
              aria-hidden
              className="inline-block size-2 rounded-full"
              style={{ background: LINE_COLORS[idx % LINE_COLORS.length] }}
            />
            {s.name}
            <span className="num text-fg4">{formatCents(s.totalCents, currency)}</span>
          </li>
        ))}
      </ul>

      {(othersTotalCents > 0 || fxIncomplete) && (
        <p className="px-1 text-[11px] text-fg4">
          {othersTotalCents > 0 && <>outras categorias: {formatCents(othersTotalCents, currency)}</>}
          {othersTotalCents > 0 && fxIncomplete && ' · '}
          {fxIncomplete && 'câmbio indisponível — valores parciais'}
        </p>
      )}
    </div>
  );
}
