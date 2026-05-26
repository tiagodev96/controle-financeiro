'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteInstallmentPlanAction } from '@/server/actions/installments/actions';
import { Num, type Currency } from '@/components/finance/num';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  title: string;
  totalCents: number;
  perInstallmentCents: number;
  currency: Currency;
  totalInstallments: number;
  paidCount: number;
  pendingCount: number;
  isFinished: boolean;
  firstDueDate: string;
};

function formatShortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
}

export function InstallmentListItem({
  id,
  title,
  totalCents,
  perInstallmentCents,
  currency,
  totalInstallments,
  paidCount,
  pendingCount,
  isFinished,
  firstDueDate,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const completed = totalInstallments - pendingCount;
  const pct = totalInstallments > 0 ? completed / totalInstallments : 0;
  const pctLabel = Math.round(pct * 100);

  function handleDelete() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await deleteInstallmentPlanAction({ planId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Parcelado cancelado.');
    });
  }

  return (
    <div
      data-testid={`plan-row-${id}`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border-soft bg-bg-surface p-3.5',
        isFinished && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-[15px] font-medium text-fg1">{title}</p>
          <p className="mono text-[10px] text-fg4">
            {totalInstallments}× <Num cents={perInstallmentCents} currency={currency} className="text-fg3" /> ={' '}
            <Num cents={totalCents} currency={currency} className="text-fg3" />
            {' · 1ª em '}
            {formatShortDate(firstDueDate)}
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={`Ações para ${title}`}
            disabled={pending}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex size-8 items-center justify-center rounded-md text-fg3 transition-colors hover:bg-bg-raised hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <MoreHorizontal className="size-4" strokeWidth={1.6} aria-hidden />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div className="absolute right-0 top-9 z-40 min-w-[180px] rounded-md border border-border-soft bg-bg-raised py-1 shadow-md">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-money-negative hover:bg-bg-inset"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Cancelar plano
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Num cents={perInstallmentCents} currency={currency} className="text-[18px] font-semibold text-fg1" />
          <span className="text-[11px] text-fg4">
            parcela {Math.min(paidCount + 1, totalInstallments)}/{totalInstallments} · {pctLabel}% pago
          </span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-bg-inset"
          role="progressbar"
          aria-valuenow={pctLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pctLabel}% pago`}
        >
          <div
            className="h-full bg-brand"
            style={{ width: `${Math.max(pct * 100, isFinished ? 100 : pct > 0 ? 4 : 0)}%` }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
