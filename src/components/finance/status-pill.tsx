import { cn } from '@/lib/utils';

export type Status = 'paid' | 'pending' | 'overdue' | 'recurring';

const STYLES: Record<Status, string> = {
  paid: 'bg-status-paid-bg text-status-paid-fg',
  pending: 'bg-status-pending-bg text-status-pending-fg',
  overdue: 'bg-status-overdue-bg text-status-overdue-fg',
  recurring: 'bg-bg-inset text-fg3',
};

const LABELS: Record<Status, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Em atraso',
  recurring: 'Recorrente',
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
