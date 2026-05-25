import { cn } from '@/lib/utils';
import { formatCentsToBRL } from '@/lib/money/format';
import { StatusPill, type Status } from './status-pill';

type Props = {
  description: string;
  category: string;
  amountCents: number;
  currency?: 'BRL' | 'EUR';
  direction: 'income' | 'expense';
  status?: Status;
  action?: React.ReactNode;
  className?: string;
};

const SYMBOL: Record<'BRL' | 'EUR', string> = {
  BRL: 'R$',
  EUR: '€',
};

export function TxnRow({
  description,
  category,
  amountCents,
  currency = 'BRL',
  direction,
  status,
  action,
  className,
}: Props) {
  const isIncome = direction === 'income';
  // Sinal de negativo é U+2212 (não hífen) por decisão do design system.
  const sign = isIncome ? '+' : '−';

  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[15px] text-fg1">{description}</p>
        <div className="flex items-center gap-2 text-xs text-fg3">
          <span className="truncate">{category}</span>
          {status && <StatusPill status={status} />}
        </div>
      </div>
      <p
        className={cn(
          'num shrink-0 text-right text-[15px] font-semibold',
          isIncome ? 'text-money-positive' : 'text-money-negative',
        )}
      >
        {sign}{SYMBOL[currency]} {formatCentsToBRL(amountCents)}
      </p>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
