import { cn } from '@/lib/utils';

export type Status = 'paid' | 'pending' | 'overdue' | 'recurring';

const STYLES: Record<Status, { bg: string; fg: string; dot: string; border: string }> = {
  paid: {
    bg: 'bg-status-paid-bg',
    fg: 'text-status-paid-fg',
    dot: 'bg-status-paid-fg',
    border: 'border-status-paid-fg/30',
  },
  pending: {
    bg: 'bg-status-pending-bg',
    fg: 'text-status-pending-fg',
    dot: 'bg-status-pending-fg',
    border: 'border-status-pending-fg/30',
  },
  overdue: {
    bg: 'bg-status-overdue-bg',
    fg: 'text-status-overdue-fg',
    dot: 'bg-status-overdue-fg',
    border: 'border-status-overdue-fg/30',
  },
  recurring: {
    bg: 'bg-brand-quiet-bg',
    fg: 'text-brand-quiet-fg',
    dot: 'bg-brand-quiet-fg',
    border: 'border-brand/30',
  },
};

const LABELS: Record<Status, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Em atraso',
  recurring: 'Recorrente',
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        s.bg,
        s.fg,
        s.border,
        className,
      )}
    >
      <span className={cn('size-1 rounded-full', s.dot)} aria-hidden />
      {LABELS[status]}
    </span>
  );
}
