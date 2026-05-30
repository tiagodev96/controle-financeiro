'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyInput } from '@/components/finance/money-input';
import { MonthInput } from '@/components/finance/month-input';
import { Num, type Currency } from '@/components/finance/num';
import { updateDebtAction } from '@/server/actions/debts/actions';
import { monthToDeadlineIso } from '@/lib/finance/debt-deadline';
import { cn } from '@/lib/utils';

type Priority = 1 | 2 | 3;

const PRIORITY_LABEL: Record<Priority, string> = {
  1: 'Alta',
  2: 'Média',
  3: 'Baixa',
};

type Props = {
  debtId: string;
  currentTitle: string;
  currentOriginalCents: number;
  paidCents: number;
  currency: Currency;
  currentPriority: Priority;
  currentNotes: string | null;
  currentTargetQuitDate: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function EditDebtDialog({
  debtId,
  currentTitle,
  currentOriginalCents,
  paidCents,
  currency,
  currentPriority,
  currentNotes,
  currentTargetQuitDate,
  open,
  onOpenChange,
}: Props) {
  const [title, setTitle] = useState(currentTitle);
  const [originalCents, setOriginalCents] = useState(currentOriginalCents);
  const [priority, setPriority] = useState<Priority>(currentPriority);
  const [quitMonth, setQuitMonth] = useState(currentTargetQuitDate?.slice(0, 7) ?? '');
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const belowPaid = originalCents < paidCents;
  const newRemaining = Math.max(originalCents - paidCents, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await updateDebtAction({
      debtId,
      patch: {
        title,
        originalAmountCents: originalCents,
        priority,
        notes: notes.trim() || null,
        targetQuitDate: quitMonth ? monthToDeadlineIso(quitMonth) : null,
      },
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Dívida atualizada.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar dívida</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <label className="block space-y-2">
            <span className="eyebrow">Título</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <MoneyInput
            label="Valor original"
            valueCents={originalCents}
            onChange={setOriginalCents}
          />

          {paidCents > 0 && (
            <p className="text-[12px] text-fg3">
              Já pagos: <Num cents={paidCents} currency={currency} className="text-fg2" />
              {' · '}
              Restará: <Num cents={newRemaining} currency={currency} className={belowPaid ? 'text-money-positive' : 'text-fg2'} />
              {belowPaid && ' (dívida será fechada)'}
            </p>
          )}

          <label className="block space-y-2">
            <span className="eyebrow">Prioridade</span>
            <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1">
              {([1, 2, 3] as const).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                  className={cn(
                    'h-9 rounded-sm text-sm font-medium transition-colors',
                    priority === p ? 'bg-bg-surface text-fg1 shadow-sm' : 'text-fg3 hover:text-fg1',
                  )}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </label>

          <MonthInput
            label="Quitar até (opcional)"
            value={quitMonth}
            onChange={setQuitMonth}
            placeholder="Selecionar mês"
          />

          <label className="block space-y-2">
            <span className="eyebrow">Notas (opcional)</span>
            <textarea
              maxLength={200}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !title.trim() || originalCents === 0}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
