import { iconForCategory } from '@/lib/finance/category-icons';
import { Num, type Currency } from './num';
import type { CategorySpent } from '@/lib/finance/dashboard-stats';

type Props = {
  rows: CategorySpent[];
  currency: Currency;
};

export function CategoryProgressList({ rows, currency }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border-soft bg-bg-surface p-4 text-center text-sm text-fg3">
        Sem despesas neste mês.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((c) => {
        const Icon = iconForCategory(c.name);
        return (
          <div key={c.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-medium text-fg2">
                <Icon className="size-3.5 text-fg3" strokeWidth={1.6} aria-hidden />
                {c.name}
              </span>
              <Num cents={c.totalCents} currency={currency} className="text-[13px] font-semibold text-fg2" />
            </div>
            <div className="h-1 rounded-full bg-bg-inset overflow-hidden">
              <div
                className="h-full bg-brand"
                style={{ width: `${Math.max(c.pctOfMax * 100, 4)}%` }}
                aria-hidden
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
