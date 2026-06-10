import type { ConversionAdvice, LastComparison } from '@/lib/fx';
import { formatNumberPtBR, formatRate } from '@/lib/money/format';

type Props = {
  advice: ConversionAdvice;
  rateDate: string | null;
  isStale: boolean;
};

const HEADLINE: Record<ConversionAdvice['signal'], string> = {
  convert_eur_to_brl: 'Momento favorável pra converter euro em real',
  convert_brl_to_eur: 'Momento favorável pra converter real em euro',
  neutral: 'Câmbio em patamar intermediário',
};

function rate(value: number): string {
  return formatRate(value);
}

function pct(value: number): string {
  return formatNumberPtBR(value, 1);
}

function signedPct(fraction: number): string {
  const value = fraction * 100;
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${pct(Math.abs(value))}%`;
}

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function ComparisonLine({
  label,
  unit,
  cmp,
}: {
  label: string;
  unit: string;
  cmp: LastComparison;
}) {
  return (
    <p className="text-[12px] text-fg3">
      {label} (última {shortDate(cmp.convertedOn)}):{' '}
      <span className="num text-fg2">{rate(cmp.effectiveRate)}</span> {unit} · hoje{' '}
      <span className="num text-fg1">{rate(cmp.currentEstimatedRate)}</span> {unit}{' '}
      <span className="num text-fg4">({signedPct(cmp.diffPct)})</span>
    </p>
  );
}

export function ConversionSignalCard({ advice, rateDate, isStale }: Props) {
  const {
    signal,
    windowPosition,
    windowLow,
    windowHigh,
    windowDays,
    wiseSpreadPct,
    spreadSampleSize,
    currentEurBrl,
    netEurBrl,
    comparisonToLast,
  } = advice;

  const favorable = signal !== 'neutral';

  return (
    <section className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className={
            favorable
              ? 'mt-1.5 size-2 shrink-0 rounded-full bg-brand'
              : 'mt-1.5 size-2 shrink-0 rounded-full bg-fg4'
          }
        />
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-fg1">{HEADLINE[signal]}</p>
          <p className="text-[12px] text-fg3">
            Hoje 1€ = <span className="num text-fg1">R$ {rate(currentEurBrl)}</span>
            {rateDate && (
              <span className="mono text-[10px] text-fg4">
                {' '}· {isStale ? 'cotação de ' : ''}
                {shortDate(rateDate)}
              </span>
            )}
            {windowPosition !== null && windowLow !== null && windowHigh !== null && (
              <>
                {' — '}
                {signal === 'convert_eur_to_brl'
                  ? `euro mais caro que ${Math.round(windowPosition * 100)}% dos últimos ${windowDays} dias`
                  : signal === 'convert_brl_to_eur'
                    ? `euro mais barato que ${100 - Math.round(windowPosition * 100)}% dos últimos ${windowDays} dias`
                    : `euro no meio da faixa dos últimos ${windowDays} dias`}
                <span className="mono text-[10px] text-fg4">
                  {' '}(R$ {rate(windowLow)}–{rate(windowHigh)})
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {wiseSpreadPct === null ? (
        <p className="rounded-sm bg-bg-inset px-3 py-2 text-[12px] text-fg3">
          Registre uma conversão pra eu estimar quanto a Wise cobra e ajustar a taxa.
        </p>
      ) : (
        <p className="rounded-sm bg-bg-inset px-3 py-2 text-[12px] text-fg3">
          Na Wise, com seu spread médio de{' '}
          <span className="num text-fg1">{pct(wiseSpreadPct * 100)}%</span>{' '}
          <span className="text-fg4">
            ({spreadSampleSize} {spreadSampleSize === 1 ? 'conversão' : 'conversões'})
          </span>
          , ~<span className="num text-fg1">R$ {rate(netEurBrl)}</span> por euro.
        </p>
      )}

      {(comparisonToLast.eurToBrl || comparisonToLast.brlToEur) && (
        <div className="space-y-1 border-t border-border-soft pt-2">
          {comparisonToLast.eurToBrl && (
            <ComparisonLine
              label="Euro → real"
              unit="R$/€"
              cmp={comparisonToLast.eurToBrl}
            />
          )}
          {comparisonToLast.brlToEur && (
            <ComparisonLine
              label="Real → euro"
              unit="€/R$"
              cmp={comparisonToLast.brlToEur}
            />
          )}
        </div>
      )}
    </section>
  );
}
