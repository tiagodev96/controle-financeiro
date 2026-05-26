import { cn } from '@/lib/utils';
import { formatCentsToBRL } from '@/lib/money/format';
import { StatusPill, type Status } from './status-pill';

type SourcePill = { kind: 'recurring' } | { kind: 'installment'; number: number; total: number };

type Props = {
  description: string;
  category: string;
  amountCents: number;
  currency?: 'BRL' | 'EUR';
  direction: 'income' | 'expense';
  status?: Status;
  source?: SourcePill | null;
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
  source,
  action,
  className,
}: Props) {
  const isIncome = direction === 'income';

  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[15px] text-fg1">{description}</p>
        <div className="flex items-center gap-2 text-xs text-fg3">
          <span className="truncate">{category}</span>
          {status && <StatusPill status={status} />}
          {source?.kind === 'recurring' && (
            <span className="mono inline-flex h-4 items-center rounded-xs bg-brand-quiet-bg px-1 text-[9px] font-semibold uppercase tracking-wider text-brand-quiet-fg">
              REC
            </span>
          )}
          {source?.kind === 'installment' && (
            <span className="mono inline-flex h-4 items-center rounded-xs bg-brand-quiet-bg px-1 text-[9px] font-semibold tabular-nums text-brand-quiet-fg">
              {source.number}/{source.total}
            </span>
          )}
        </div>
      </div>
      <p
        className={cn(
          'num shrink-0 text-right text-[15px] font-semibold',
          isIncome ? 'text-money-positive' : 'text-money-negative',
        )}
      >
        {SYMBOL[currency]} {formatCentsToBRL(amountCents)}
      </p>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
