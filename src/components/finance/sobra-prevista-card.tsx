import { Num, type Currency } from './num';
import type { MonthStats } from '@/lib/finance/dashboard-stats';

type Props = {
  stats: MonthStats;
  currency: Currency;
  endOfMonthLabel: string;
};

/**
 * Card de sobra prevista — saldo + entradas pendentes - despesas pendentes
 * até o fim do mês. Mostra a quebra inline (pagos/pendentes/atraso) embaixo.
 */
export function SobraPrevistaCard({ stats, currency, endOfMonthLabel }: Props) {
  const isPositive = stats.sobraPrevistaCents >= 0;
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-[15px] text-fg3">Sobra prevista</p>
          <p className="mono text-[10px] text-fg4">até {endOfMonthLabel}</p>
        </div>
        <span className="mono text-[10px] uppercase tracking-wider text-brand-quiet-fg bg-brand-quiet-bg rounded-xs px-1.5 py-0.5">
          {currency}
        </span>
      </div>
      <Num
        cents={stats.sobraPrevistaCents}
        currency={currency}
        sign={isPositive}
        className={isPositive ? 'text-[32px] font-bold tracking-tight text-money-positive' : 'text-[32px] font-bold tracking-tight text-money-negative'}
      />
      <div className="h-px bg-border-soft" />
      <div className="grid grid-cols-3 gap-3 text-[11px]">
        <Breakdown label="Pago" cents={stats.paid.totalCents} sign={false} currency={currency} tone="positive" />
        <Breakdown label="Pendente" cents={-stats.pending.totalCents} sign currency={currency} tone="neutral" />
        <Breakdown label="Atraso" cents={-stats.overdue.totalCents} sign currency={currency} tone={stats.overdue.totalCents > 0 ? 'negative' : 'neutral'} />
      </div>
    </div>
  );
}

function Breakdown({
  label,
  cents,
  sign,
  currency,
  tone,
}: {
  label: string;
  cents: number;
  sign: boolean;
  currency: Currency;
  tone: 'positive' | 'neutral' | 'negative';
}) {
  const color =
    tone === 'positive'
      ? 'text-money-positive'
      : tone === 'negative'
        ? 'text-money-negative'
        : 'text-fg2';
  return (
    <div className="space-y-0.5">
      <p className="mono text-[10px] uppercase tracking-wider text-fg4">{label}</p>
      <Num cents={cents} currency={currency} sign={sign} className={`text-[13px] font-semibold ${color}`} />
    </div>
  );
}
