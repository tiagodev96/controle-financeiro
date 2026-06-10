'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteRecurringAction,
  pauseRecurringAction,
  resumeRecurringAction,
} from '@/server/actions/recurring/actions';
import { Num, type Currency } from '@/components/finance/num';
import { EditRecurringDialog } from './edit-dialog';
import { MONTHS_PT } from '@/lib/dates';
import { cn } from '@/lib/utils';

type Direction = 'expense' | 'income';

type Category = { id: string; name: string; kind: Direction };
type Account = { id: string; name: string; currency: Currency };

type Props = {
  id: string;
  title: string;
  amountCents: number;
  currency: Currency;
  direction: Direction;
  dayOfMonth: number;
  frequency: 'monthly' | 'yearly';
  /** Mês-aniversário (active_from) — só relevante pra frequency anual. */
  activeFrom: string | null;
  paused: boolean;
  categoryId: string | null;
  accountId: string | null;
  notes: string | null;
  categories: Category[];
  accounts: Account[];
};

export function RecurringListItem({
  id,
  title,
  amountCents,
  currency,
  direction,
  dayOfMonth,
  frequency,
  activeFrom,
  paused,
  categoryId,
  accountId,
  notes,
  categories,
  accounts,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isIncome = direction === 'income';

  function handlePauseToggle() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = paused
        ? await resumeRecurringAction({ ruleId: id })
        : await pauseRecurringAction({ ruleId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success(paused ? 'Retomada.' : 'Pausada.');
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await deleteRecurringAction({ ruleId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Regra removida.');
    });
  }

  return (
    <div className={cn('flex items-center gap-3 py-3', paused && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[15px] text-fg1">{title}</p>
        <p className="mono text-[10px] text-fg4">
          {frequency === 'yearly' && activeFrom
            ? `anual · ${MONTHS_PT[Number(activeFrom.slice(5, 7)) - 1]}, dia ${dayOfMonth}`
            : `todo dia ${dayOfMonth}`}
        </p>
      </div>

      <Num
        cents={isIncome ? amountCents : -amountCents}
        currency={currency}
        sign={isIncome}
        className={cn(
          'shrink-0 text-right text-[15px] font-semibold',
          isIncome ? 'text-money-positive' : 'text-money-negative',
        )}
      />

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
            <div className="absolute right-0 top-9 z-40 min-w-40 rounded-md border border-border-soft bg-bg-raised py-1 shadow-md">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
              >
                <Pencil className="size-3.5" strokeWidth={1.6} aria-hidden />
                Editar
              </button>
              <button
                type="button"
                onClick={handlePauseToggle}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
              >
                {paused ? (
                  <>
                    <Play className="size-3.5" strokeWidth={1.6} aria-hidden />
                    Retomar
                  </>
                ) : (
                  <>
                    <Pause className="size-3.5" strokeWidth={1.6} aria-hidden />
                    Pausar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-money-negative hover:bg-bg-inset"
              >
                <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                Cancelar regra
              </button>
            </div>
          </>
        )}
      </div>

      {editOpen && (
        <EditRecurringDialog
          ruleId={id}
          direction={direction}
          currentTitle={title}
          currentAmountCents={amountCents}
          currentDayOfMonth={dayOfMonth}
          currentFrequency={frequency}
          currentAnniversaryMonth={activeFrom ? activeFrom.slice(0, 7) : null}
          currentCategoryId={categoryId}
          currentAccountId={accountId}
          currentNotes={notes}
          categories={categories}
          accounts={accounts}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}
