import { createElement } from 'react';
import { AlertTriangle, Gauge } from 'lucide-react';
import Link from 'next/link';
import type { CategoryLimit } from '@/lib/finance/category-limits';
import type { Currency } from './num';
import { resolveCategoryIcon } from '@/lib/finance/category-icons';
import { Num } from './num';
import { cn } from '@/lib/utils';

type Props = {
  limits: CategoryLimit[];
  currency: Currency;
};

export function CategoryLimitsCard({ limits, currency }: Props) {
  // Mostra só warning/over no dashboard. "ok" não polui.
  const flagged = limits.filter((l) => l.status !== 'ok');
  if (flagged.length === 0) return null;

  return (
    <section className="space-y-2">
      <header className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-1.5">
          <Gauge className="size-3.5 text-fg3" strokeWidth={1.6} aria-hidden />
          Limites
        </h2>
        <Link href="/categorias" className="mono text-[10px] text-fg3 hover:text-fg1">
          gerenciar
        </Link>
      </header>
      <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface">
        {flagged.map((l) => {
          const Icon = resolveCategoryIcon({ name: l.name, icon: l.icon });
          const pctLabel = Math.min(Math.round(l.pct * 100), 999);
          const isOver = l.status === 'over';
          return (
            <div key={l.id} className="space-y-2 px-3.5 py-3">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {createElement(Icon, {
                    className: 'size-3.5 shrink-0 text-fg3',
                    strokeWidth: 1.6,
                    'aria-hidden': true,
                  })}
                  <span className="truncate text-fg2">{l.name}</span>
                  {isOver && (
                    <AlertTriangle className="size-3 shrink-0 text-money-negative" strokeWidth={1.8} aria-hidden />
                  )}
                </div>
                <span
                  className={cn(
                    'mono shrink-0 text-[11px] font-semibold',
                    isOver ? 'text-money-negative' : 'text-status-pending-fg',
                  )}
                >
                  {pctLabel}%
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-bg-inset"
                role="progressbar"
                aria-valuenow={pctLabel}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${pctLabel}% do limite`}
              >
                <div
                  className={cn(
                    'h-full transition-all',
                    isOver ? 'bg-money-negative' : 'bg-status-pending-fg',
                  )}
                  style={{ width: `${Math.min(l.pct * 100, 100)}%` }}
                  aria-hidden
                />
              </div>
              <div className="flex justify-between text-[10px] text-fg4">
                <span>
                  <Num cents={l.spentCents} currency={currency} className="text-fg3" /> gastos
                </span>
                <span>
                  limite <Num cents={l.limitCents} currency={currency} className="text-fg3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
