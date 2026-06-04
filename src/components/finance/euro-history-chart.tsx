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
import type { RatePoint } from '@/lib/fx';

type Period = '7d' | '30d' | '1y';

type Props = {
  series: RatePoint[];
};

const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: '7d', label: '7 dias', days: 7 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '1y', label: '1 ano', days: null },
];

const MONTHS_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

function formatRate(rate: number): string {
  return `R$ ${rate.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${MONTHS_SHORT[Number(m) - 1]}`;
}

function dateBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function sliceByPeriod(series: RatePoint[], days: number | null): RatePoint[] {
  if (days === null || series.length === 0) return series;
  const last = series[series.length - 1]!.date;
  const cutoff = dateBefore(last, days);
  return series.filter((p) => p.date >= cutoff);
}

type RechartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: RatePoint }>;
};

function ChartTooltip({ active, payload }: RechartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-md border border-border-soft bg-bg-raised px-3 py-2 shadow-md">
      <p className="mono text-[10px] uppercase tracking-wider text-fg4">
        {formatDateShort(point.date)}
      </p>
      <p className="num text-[14px] font-semibold text-fg1">{formatRate(point.rate)}</p>
    </div>
  );
}

export function EuroHistoryChart({ series }: Props) {
  const [period, setPeriod] = useState<Period>('30d');
  const days = PERIODS.find((p) => p.key === period)!.days;
  const data = sliceByPeriod(series, days);
  const hasData = data.length >= 2;

  return (
    <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="eyebrow">Valor do euro</p>
          <p className="text-[11px] text-fg4">quantos reais vale 1 euro · BCE</p>
        </div>
        <div className="inline-flex rounded-md border border-border-soft bg-bg-inset p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
              className={
                period === p.key
                  ? 'rounded-sm bg-bg-raised px-2 py-1 text-[11px] font-semibold text-fg1'
                  : 'rounded-sm px-2 py-1 text-[11px] font-medium text-fg4 hover:text-fg1'
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {!hasData ? (
        <div className="flex items-center justify-center rounded-md border border-dashed border-border-soft py-12 text-sm text-fg4">
          Sem cotação suficiente pra traçar a linha ainda.
        </div>
      ) : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-soft)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateShort}
                stroke="var(--color-fg4)"
                tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border-soft)' }}
                minTickGap={32}
              />
              <YAxis
                tickFormatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                stroke="var(--color-fg4)"
                tick={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={false}
                width={44}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={(p: RechartTooltipProps) => <ChartTooltip {...p} />}
                cursor={{ stroke: 'var(--color-border)', strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--color-brand)', strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
