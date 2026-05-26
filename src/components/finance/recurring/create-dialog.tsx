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
import { FormSelect } from '@/components/finance/form-select';
import { createRecurringAction } from '@/server/actions/recurring/actions';
import { cn } from '@/lib/utils';

type Direction = 'expense' | 'income';

type Category = { id: string; name: string; kind: 'expense' | 'income' };
type Account = { id: string; name: string; currency: 'BRL' | 'EUR' };

type Props = {
  categories: Category[];
  accounts: Account[];
};

export function CreateRecurringDialog({ categories, accounts }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [direction, setDirection] = useState<Direction>('expense');
  const [categoryId, setCategoryId] = useState<string>(
    categories.find((c) => c.kind === 'expense')?.id ?? '',
  );
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(5);
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = categories.filter((c) => c.kind === direction);

  function changeDirection(d: Direction) {
    setDirection(d);
    setCategoryId(categories.find((c) => c.kind === d)?.id ?? '');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await createRecurringAction({
      title,
      amountCents,
      direction,
      categoryId,
      accountId,
      dayOfMonth,
      notes: notes.trim() || null,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Regra criada.');
    setTitle('');
    setAmountCents(0);
    setNotes('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" strokeWidth={1.8} aria-hidden />
            Nova regra
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova regra recorrente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <label className="block space-y-2">
            <span className="eyebrow">Tipo</span>
            <div className="grid grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1">
              {(['expense', 'income'] as const).map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => changeDirection(d)}
                  aria-pressed={direction === d}
                  className={cn(
                    'h-9 rounded-sm text-sm font-medium transition-colors',
                    direction === d ? 'bg-bg-surface text-fg1 shadow-sm' : 'text-fg3 hover:text-fg1',
                  )}
                >
                  {d === 'expense' ? 'Despesa' : 'Entrada'}
                </button>
              ))}
            </div>
          </label>

          <label className="block space-y-2">
            <span className="eyebrow">Título</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={50}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={direction === 'income' ? 'Ex: Salário' : 'Ex: Aluguel'}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <MoneyInput
            label="Valor"
            valueCents={amountCents}
            onChange={setAmountCents}
          />

          <FormSelect
            label="Categoria"
            required
            value={categoryId}
            onChange={setCategoryId}
            options={visibleCategories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <div className="grid grid-cols-2 gap-2.5">
            <FormSelect
              label="Conta"
              required
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
            />
            <label className="block space-y-2">
              <span className="eyebrow">Dia do mês</span>
              <input
                type="number"
                required
                min={1}
                max={28}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

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
            disabled={pending || !title.trim() || amountCents === 0 || !categoryId || !accountId}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Criar regra'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
