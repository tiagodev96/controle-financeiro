'use client';

import { useState, useTransition } from 'react';
import { MoreHorizontal, RotateCcw, CheckCircle2, Pencil, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  closeDebtManuallyAction,
  deleteDebtAction,
  reopenDebtAction,
} from '@/server/actions/debts/actions';
import { Num, type Currency } from '@/components/finance/num';
import { EditDebtDialog } from './edit-dialog';
import { RegisterPaymentDialog } from './register-payment-dialog';
import { cn } from '@/lib/utils';

type Priority = 1 | 2 | 3;

type Account = {
  id: string;
  name: string;
  currency: Currency;
};

type Props = {
  id: string;
  title: string;
  originalCents: number;
  remainingCents: number;
  currency: Currency;
  priority: Priority;
  status: 'open' | 'closed';
  notes: string | null;
  accounts: Account[];
};

const PRIORITY_LABEL: Record<Priority, string> = {
  1: 'Alta',
  2: 'Média',
  3: 'Baixa',
};

const PRIORITY_CLASSES: Record<Priority, string> = {
  1: 'bg-status-overdue-bg text-status-overdue-fg',
  2: 'bg-status-pending-bg text-status-pending-fg',
  3: 'bg-brand-quiet-bg text-brand-quiet-fg',
};

export function DebtListItem({
  id,
  title,
  originalCents,
  remainingCents,
  currency,
  priority,
  status,
  notes,
  accounts,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isOpen = status === 'open';
  const paidCents = Math.max(originalCents - remainingCents, 0);
  const pct = originalCents > 0 ? Math.min(paidCents / originalCents, 1) : 0;
  const pctLabel = Math.round(pct * 100);

  function handleClose() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await closeDebtManuallyAction({ debtId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Dívida fechada.');
    });
  }

  function handleReopen() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await reopenDebtAction({ debtId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Dívida reaberta.');
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await deleteDebtAction({ debtId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Dívida removida.');
    });
  }

  return (
    <div
      data-testid={`debt-row-${id}`}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border-soft bg-bg-surface p-3.5',
        !isOpen && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-sm px-1.5 text-[10px] font-semibold uppercase tracking-wider',
                PRIORITY_CLASSES[priority],
              )}
            >
              {PRIORITY_LABEL[priority]}
            </span>
            <p className="truncate text-[15px] font-medium text-fg1">{title}</p>
          </div>
          {notes && <p className="truncate text-[12px] text-fg3">{notes}</p>}
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
                  onClick={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                >
                  <Pencil className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Editar
                </button>
                {isOpen ? (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                  >
                    <CheckCircle2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                    Marcar como quitada
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReopen}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                  >
                    <RotateCcw className="size-3.5" strokeWidth={1.6} aria-hidden />
                    Reabrir
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-money-negative hover:bg-bg-inset"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Cancelar dívida
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <Num
            cents={remainingCents}
            currency={currency}
            className="text-[18px] font-semibold text-fg1"
          />
          <span className="text-[11px] text-fg4">
            de <Num cents={originalCents} currency={currency} className="text-fg3" /> · {pctLabel}% pago
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
            style={{ width: `${Math.max(pct * 100, isOpen && pct > 0 ? 4 : 0)}%` }}
            aria-hidden
          />
        </div>
      </div>

      {isOpen && (
        <button
          type="button"
          onClick={() => setPayOpen(true)}
          disabled={pending}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-brand text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <Wallet className="size-3.5" strokeWidth={1.8} aria-hidden />
          Registrar pagamento
        </button>
      )}

      {payOpen && (
        <RegisterPaymentDialog
          debtId={id}
          debtTitle={title}
          remainingCents={remainingCents}
          currency={currency}
          accounts={accounts}
          open={payOpen}
          onOpenChange={setPayOpen}
        />
      )}

      {editOpen && (
        <EditDebtDialog
          debtId={id}
          currentTitle={title}
          currentOriginalCents={originalCents}
          paidCents={paidCents}
          currency={currency}
          currentPriority={priority}
          currentNotes={notes}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}
