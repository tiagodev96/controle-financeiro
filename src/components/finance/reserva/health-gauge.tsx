import { type ReservaBand, bandLabel, bandCopy } from '@/lib/finance/reserva';
import { formatNumberPtBR } from '@/lib/money/format';
import { Num, type Currency } from '@/components/finance/num';

type Props = {
  band: ReservaBand;
  monthsCovered: number;
  monthlyEssentialCents: number;
  allocatedCents: number;
  currency: Currency;
  variableCalibrating: boolean;
};

const MARKS = [3, 6, 12] as const;
const SCALE_MAX = 12;

/**
 * Gauge editorial da reserva: meses cobertos como número-herói, faixa absoluta
 * ancorada no consenso (marcas em 3/6/12). Sem tokens money-positive/negative
 * (reservados a entrada/despesa) — só brand + neutros de fg, conforme o
 * "Livro-razão". Sem gamificação: é medidor de saúde, não progressão.
 */
export function ReservaHealthGauge({
  band,
  monthsCovered,
  monthlyEssentialCents,
  allocatedCents,
  currency,
  variableCalibrating,
}: Props) {
  const fillPct = Math.min(monthsCovered / SCALE_MAX, 1) * 100;
  const monthsLabel = formatNumberPtBR(monthsCovered, 1);
  const isCritical = band === 'sem_reserva';

  return (
    <section className="space-y-4 rounded-md border border-border-soft bg-bg-surface p-5">
      <div className="space-y-1">
        <p className="eyebrow">{bandLabel(band)}</p>
        <div className="flex items-baseline gap-2">
          <span className="num text-[44px] font-bold leading-none tracking-[-0.035em] text-fg1">
            {monthsLabel}
          </span>
          <span className="text-[15px] text-fg3">meses cobertos</span>
        </div>
        <p className={isCritical ? 'text-[13px] text-status-overdue-fg' : 'text-[13px] text-fg3'}>
          {bandCopy(band)}
        </p>
      </div>

      <div className="space-y-2">
        <div className="relative h-2 overflow-hidden rounded-full bg-bg-inset">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${Math.max(fillPct, monthsCovered > 0 ? 3 : 0)}%` }}
            role="progressbar"
            aria-valuenow={Math.round(monthsCovered * 10) / 10}
            aria-valuemin={0}
            aria-valuemax={SCALE_MAX}
            aria-label={`${monthsLabel} meses cobertos`}
          />
        </div>
        <div className="relative h-4">
          {MARKS.map((m) => (
            <span
              key={m}
              className="absolute mono text-[10px] text-fg4"
              style={{ left: `${(m / SCALE_MAX) * 100}%`, transform: 'translateX(-50%)' }}
            >
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border-soft pt-3 text-[12px] text-fg3">
        <span>
          guardado{' '}
          <Num cents={allocatedCents} currency={currency} className="font-semibold text-fg2" />
        </span>
        <span>
          custo essencial{' '}
          <Num cents={monthlyEssentialCents} currency={currency} className="font-semibold text-fg2" />
          /mês
        </span>
      </div>

      {variableCalibrating && (
        <p className="rounded-md border border-border-soft bg-bg-inset px-3 py-2 text-[11px] text-fg4">
          Parte variável calibrando — precisa de 3 meses completos de histórico. Por ora o
          custo considera só os recorrentes.
        </p>
      )}
    </section>
  );
}
