import { cn } from '@/lib/utils';
import { Num, type Currency } from './num';
import type { MonthStats } from '@/lib/finance/dashboard-stats';

type Bucket = 'paid' | 'pending' | 'overdue';

const META: Record<Bucket, { label: string; sub: (n: number) => string; dot: string; numClass: string }> = {
  paid: {
    label: 'Pago',
    sub: (n) => `${n} lanç.`,
    dot: 'bg-status-paid-fg',
    numClass: 'text-fg1',
  },
  pending: {
    label: 'Pendente',
    sub: (n) => `${n} lanç.`,
    dot: 'bg-status-pending-fg',
    numClass: 'text-fg1',
  },
  overdue: {
    label: 'Em atraso',
    sub: (n) => (n === 0 ? '—' : `${n} lanç.`),
    dot: 'bg-status-overdue-fg',
    numClass: 'text-money-negative',
  },
};

const COLORS: Record<Bucket, string> = {
  paid: 'text-status-paid-fg',
  pending: 'text-status-pending-fg',
  overdue: 'text-status-overdue-fg',
};

function Cell({ kind, stats, currency }: { kind: Bucket; stats: MonthStats; currency: Currency }) {
  const bucket = stats[kind];
  const meta = META[kind];
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border-soft bg-bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', COLORS[kind])}>
          {meta.label}
        </span>
      </div>
      <Num cents={bucket.totalCents} currency={currency} className={cn('text-[20px] font-bold tracking-tight', meta.numClass)} />
      <span className="mono text-[10px] text-fg4">{meta.sub(bucket.count)}</span>
    </div>
  );
}

export function StatTrio({ stats, currency }: { stats: MonthStats; currency: Currency }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Cell kind="paid" stats={stats} currency={currency} />
      <Cell kind="pending" stats={stats} currency={currency} />
      <Cell kind="overdue" stats={stats} currency={currency} />
    </div>
  );
}
