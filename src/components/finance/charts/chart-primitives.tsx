'use client';

import type { ReactNode } from 'react';
import { CURRENCY_SYMBOL, formatNumberPtBR } from '@/lib/money/format';
import { MONTHS_PT_SHORT } from '@/lib/dates';
import type { Currency } from '@/components/finance/num';

/** Props padrão do CartesianGrid nos charts do app. */
export const chartGridProps = {
  strokeDasharray: '3 3',
  stroke: 'var(--color-border-soft)',
  vertical: false,
} as const;

/** Tick mono pequeno usado em todos os eixos. */
export const chartTickProps = { fontSize: 11, fontFamily: 'var(--font-mono)' } as const;

export const chartAxisLineProps = { stroke: 'var(--color-border-soft)' } as const;

export const chartCursorProps = {
  stroke: 'var(--color-border)',
  strokeDasharray: '3 3',
} as const;

/** Formata tick de eixo Y monetário: "€1.240" (sem casas). */
export function moneyTickFormatter(currency: Currency): (v: number) => string {
  return (v: number) => `${CURRENCY_SYMBOL[currency]}${formatNumberPtBR(v / 100, 0)}`;
}

/** "2026-06-09" → "09/jun". */
export function formatDayShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${MONTHS_PT_SHORT[Number(m) - 1]}`;
}

/** "2026-06" → "jun/26". */
export function formatMonthShort(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return `${MONTHS_PT_SHORT[m - 1]}/${ym.slice(2, 4)}`;
}

/** Caixa padrão do tooltip dos charts. */
export function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border-soft bg-bg-raised px-3 py-2 shadow-md">
      {children}
    </div>
  );
}
