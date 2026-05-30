'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MoneyInput } from '@/components/finance/money-input';
import { createDebtAction } from '@/server/actions/debts/actions';
import { monthToDeadlineIso } from '@/lib/finance/debt-deadline';
import { cn } from '@/lib/utils';

type Currency = 'EUR' | 'BRL';
type Priority = 1 | 2 | 3;

const PRIORITY_LABEL: Record<Priority, string> = {
  1: 'Alta',
  2: 'Média',
  3: 'Baixa',
};

export function CreateDebtDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [priority, setPriority] = useState<Priority>(2);
  const [quitMonth, setQuitMonth] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await createDebtAction({
      title,
      originalAmountCents: amount,
      currency,
      priority,
      notes: notes.trim() || null,
      targetQuitDate: quitMonth ? monthToDeadlineIso(quitMonth) : null,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Dívida criada.');
    setTitle('');
    setAmount(0);
    setQuitMonth('');
    setNotes('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-brand px-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" strokeWidth={1.8} aria-hidden />
            Nova dívida
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova dívida</DialogTitle>
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
              placeholder="Ex: Empréstimo Jefferson"
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <MoneyInput
            label="Valor original"
            valueCents={amount}
            onChange={setAmount}
          />

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block space-y-2">
              <span className="eyebrow">Moeda</span>
              <div className="grid grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1">
                {(['EUR', 'BRL'] as const).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCurrency(c)}
                    aria-pressed={currency === c}
                    className={cn(
                      'h-9 rounded-sm text-sm font-medium transition-colors',
                      currency === c ? 'bg-bg-surface text-fg1 shadow-sm' : 'text-fg3 hover:text-fg1',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>
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
          </div>

          <label className="block space-y-2">
            <span className="eyebrow">Quitar até (opcional)</span>
            <input
              type="month"
              value={quitMonth}
              onChange={(e) => setQuitMonth(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

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
            disabled={pending || !title.trim() || amount === 0}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Criar dívida'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
