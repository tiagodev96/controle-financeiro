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
  className,
}: Props) {
  const isIncome = direction === 'income';
  const sign = isIncome ? '+' : '-';

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[15px] text-fg">{description}</p>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span className="truncate">{category}</span>
          {status && <StatusPill status={status} />}
        </div>
      </div>
      <p
        className={cn(
          'num shrink-0 text-right text-[15px] font-medium',
          isIncome ? 'text-success' : 'text-fg',
        )}
      >
        {sign}{SYMBOL[currency]} {formatCentsToBRL(amountCents)}
      </p>
    </div>
  );
}
