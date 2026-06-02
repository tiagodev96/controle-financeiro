import { Num, type Currency } from './num';
import { CurrencyToggle } from './currency-toggle';
import { convertCents } from '@/lib/fx';
import type { MonthStats } from '@/lib/finance/dashboard-stats';

type FxRateMap = {
  EUR_BRL: number;
  BRL_EUR: number;
};

type Props = {
  stats: MonthStats;
  /**
   * Currency em que `stats` foi calculado pelo helper (EUR por hardcode no
   * dashboard). Usada como currency-base pra conversão se o display preferido
   * for diferente.
   */
  statsCurrency: Currency;
  displayCurrency: Currency;
  endOfMonthLabel: string;
  fxRateMap?: FxRateMap | null;
  /**
   * Se true, renderiza o toggle no canto direito do header. Some quando o
   * household só tem contas de uma moeda (caso em que a conversão não
   * agrega valor).
   */
  showToggle?: boolean;
  /** True = mês futuro (label "Sobra projetada"); false/omitido = corrente ("Sobra prevista"). */
  future?: boolean;
  /**
   * Quando presente, a sobra vem da projeção (saldo + pending real +
   * recorrente virtual não gerada) em vez do agregado de pending real.
   * Valores em `statsCurrency`, convertidos pro display igual ao resto do card.
   */
  projected?: {
    sobraCents: number;
    recurringExpenseCents: number;
    pendingExpenseCents: number;
  } | null;
};

function convertToDisplay(
  cents: number,
  from: Currency,
  to: Currency,
  rateMap: FxRateMap | null | undefined,
): number {
  if (from === to) return cents;
  if (!rateMap) return cents;
  const rate = to === 'EUR' ? rateMap.BRL_EUR : rateMap.EUR_BRL;
  return convertCents(cents, rate);
}

export function SobraPrevistaCard({
  stats,
  statsCurrency,
  displayCurrency,
  endOfMonthLabel,
  fxRateMap,
  showToggle,
  future,
  projected,
}: Props) {
  const sobra = convertToDisplay(
    projected ? projected.sobraCents : stats.sobraPrevistaCents,
    statsCurrency,
    displayCurrency,
    fxRateMap,
  );

  const isPositive = sobra >= 0;
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-[15px] text-fg3">{future ? 'Sobra projetada' : 'Sobra prevista'}</p>
          <p className="mono text-[10px] text-fg4">até {endOfMonthLabel}</p>
        </div>
        {showToggle ? (
          <CurrencyToggle current={displayCurrency} />
        ) : (
          <span className="mono text-[10px] uppercase tracking-wider text-brand-quiet-fg bg-brand-quiet-bg rounded-xs px-1.5 py-0.5">
            {displayCurrency}
          </span>
        )}
      </div>
      <Num
        cents={sobra}
        currency={displayCurrency}
        sign={isPositive}
        className={isPositive ? 'text-[32px] font-bold tracking-tight text-money-positive' : 'text-[32px] font-bold tracking-tight text-money-negative'}
      />
      <div className="h-px bg-border-soft" />
      {projected ? (
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <Breakdown
            label="Recorrentes"
            cents={convertToDisplay(projected.recurringExpenseCents, statsCurrency, displayCurrency, fxRateMap)}
            currency={displayCurrency}
            tone="neutral"
          />
          <Breakdown
            label="A vencer"
            cents={convertToDisplay(projected.pendingExpenseCents, statsCurrency, displayCurrency, fxRateMap)}
            currency={displayCurrency}
            tone="neutral"
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <Breakdown label="Pago" cents={convertToDisplay(stats.paid.totalCents, statsCurrency, displayCurrency, fxRateMap)} currency={displayCurrency} tone="positive" />
          <Breakdown label="Pendente" cents={convertToDisplay(stats.pending.totalCents, statsCurrency, displayCurrency, fxRateMap)} currency={displayCurrency} tone="neutral" />
          <Breakdown
            label="Atraso"
            cents={convertToDisplay(stats.overdue.totalCents, statsCurrency, displayCurrency, fxRateMap)}
            currency={displayCurrency}
            tone={stats.overdue.totalCents > 0 ? 'negative' : 'neutral'}
          />
        </div>
      )}
    </div>
  );
}

function Breakdown({
  label,
  cents,
  currency,
  tone,
}: {
  label: string;
  cents: number;
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
      <Num cents={cents} currency={currency} className={`text-[13px] font-semibold ${color}`} />
    </div>
  );
}
