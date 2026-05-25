import { cn } from '@/lib/utils';

export type Status = 'paid' | 'pending' | 'overdue' | 'recurring';

const STYLES: Record<Status, string> = {
  paid: 'bg-paid-bg text-paid-fg',
  pending: 'bg-pending-bg text-pending-fg',
  overdue: 'bg-overdue-bg text-overdue-fg',
  recurring: 'bg-surface-elevated text-fg-muted',
};

const LABELS: Record<Status, string> = {
  paid: 'pago',
  pending: 'pendente',
  overdue: 'em atraso',
  recurring: 'recorrente',
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
