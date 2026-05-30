import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Num, type Currency } from '@/components/finance/num';
import { cn } from '@/lib/utils';

export type DeadlineCardItem = {
  id: string;
  title: string;
  currency: Currency;
  monthLabel: string;
  relativeLabel: string;
  requiredCents: number;
  overdue: boolean;
};

export function DebtDeadlinesCard({ items }: { items: DeadlineCardItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h2>Metas de quitação</h2>
        <span className="mono text-[10px] text-fg4">
          {items.length} prazo{items.length === 1 ? '' : 's'}
        </span>
      </header>
      <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface">
        {items.map((item) => (
          <Link
            key={item.id}
            href="/dividas"
            className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-bg-raised"
          >
            <CalendarClock
              className={cn('size-4 shrink-0', item.overdue ? 'text-money-negative' : 'text-fg4')}
              strokeWidth={1.6}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-fg2">{item.title}</p>
              <p className="text-[11px] text-fg4">
                quitar até {item.monthLabel} ·{' '}
                <span className={item.overdue ? 'text-money-negative' : undefined}>
                  {item.relativeLabel}
                </span>
              </p>
            </div>
            <p className="shrink-0 text-[12px] text-fg3">
              <Num cents={item.requiredCents} currency={item.currency} className="text-fg2" />
              /mês
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
