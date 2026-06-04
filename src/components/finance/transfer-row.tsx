import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCentsToBRL } from '@/lib/money/format';

type Currency = 'BRL' | 'EUR';

type Props = {
  fromCents: number;
  fromCurrency: Currency;
  toCents: number;
  toCurrency: Currency;
  className?: string;
};

const SYMBOL: Record<Currency, string> = {
  BRL: 'R$',
  EUR: '€',
};

export function TransferRow({ fromCents, fromCurrency, toCents, toCurrency, className }: Props) {
  const isConversion = fromCurrency !== toCurrency;

  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[15px] text-fg2">
          {isConversion ? 'Conversão' : 'Transferência'}
        </p>
        <span className="mono inline-flex h-4 w-fit items-center rounded-xs border border-border-soft px-1 text-[9px] font-semibold uppercase tracking-wider text-fg3">
          Cobertura
        </span>
      </div>
      <p className="num flex shrink-0 items-center gap-1.5 text-right text-[14px] text-fg2">
        <span>
          {SYMBOL[fromCurrency]} {formatCentsToBRL(fromCents)}
        </span>
        <ArrowRight className="size-3.5 text-fg4" strokeWidth={1.6} aria-hidden />
        <span>
          {SYMBOL[toCurrency]} {formatCentsToBRL(toCents)}
        </span>
      </p>
    </div>
  );
}
