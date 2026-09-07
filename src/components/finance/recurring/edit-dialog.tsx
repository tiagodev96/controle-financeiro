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
import { FormSelect } from '@/components/finance/form-select';
import { MonthInput } from '@/components/finance/month-input';
import { updateRecurringAction } from '@/server/actions/recurring/actions';
import { monthIso } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Currency } from '@/components/finance/num';

type Direction = 'expense' | 'income';
type Frequency = 'monthly' | 'yearly';

type Category = { id: string; name: string; kind: Direction };
type Account = { id: string; name: string; currency: Currency };
type Card = { id: string; name: string };

type Props = {
  ruleId: string;
  direction: Direction;
  currentTitle: string;
  currentAmountCents: number;
  currentDayOfMonth: number;
  currentFrequency: Frequency;
  currentAnniversaryMonth: string | null;
  currentCategoryId: string | null;
  currentAccountId: string | null;
  currentCreditCardId: string | null;
  currentNotes: string | null;
  categories: Category[];
  accounts: Account[];
  cards?: Card[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

function clampDayOfMonth(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 28) return 28;
  return Math.trunc(n);
}

export function EditRecurringDialog({
  ruleId,
  direction,
  currentTitle,
  currentAmountCents,
  currentDayOfMonth,
  currentFrequency,
  currentAnniversaryMonth,
  currentCategoryId,
  currentAccountId,
  currentCreditCardId,
  currentNotes,
  categories,
  accounts,
  cards = [],
  open,
  onOpenChange,
}: Props) {
  const [title, setTitle] = useState(currentTitle);
  const [amountCents, setAmountCents] = useState(currentAmountCents);
  const [dayOfMonthRaw, setDayOfMonthRaw] = useState(String(currentDayOfMonth));
  const [frequency, setFrequency] = useState<Frequency>(currentFrequency);
  const [anniversaryMonth, setAnniversaryMonth] = useState(
    currentAnniversaryMonth ?? monthIso(new Date()),
  );
  const [categoryId, setCategoryId] = useState(currentCategoryId ?? '');
  const [payWith, setPayWith] = useState(
    currentCreditCardId ? `card:${currentCreditCardId}` : `account:${currentAccountId ?? ''}`,
  );
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleCategories = categories.filter((c) => c.kind === direction);
  const offerCards = direction === 'expense' && cards.length > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await updateRecurringAction({
      ruleId,
      patch: {
        title,
        amountCents,
        dayOfMonth: clampDayOfMonth(dayOfMonthRaw),
        frequency,
        ...(frequency === 'yearly' ? { anniversaryMonth } : {}),
        categoryId,
        ...(payWith.startsWith('card:')
          ? { creditCardId: payWith.slice(5) }
          : { accountId: payWith.slice(8), creditCardId: null }),
        notes: notes.trim() || null,
      },
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Regra atualizada.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar regra recorrente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <label className="block space-y-2">
            <span className="eyebrow">Título</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={50}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
              label={offerCards ? 'Pagar com' : 'Conta'}
              required
              value={payWith}
              onChange={setPayWith}
              options={[
                ...accounts.map((a) => ({
                  value: `account:${a.id}`,
                  label: `${a.name} (${a.currency})`,
                })),
                ...(offerCards
                  ? cards.map((c) => ({ value: `card:${c.id}`, label: `${c.name} (cartão)` }))
                  : []),
              ]}
            />
            <label className="block space-y-2">
              <span className="eyebrow">Dia do mês</span>
              <input
                type="number"
                required
                min={1}
                max={28}
                value={dayOfMonthRaw}
                onChange={(e) => setDayOfMonthRaw(e.target.value)}
                onBlur={() => setDayOfMonthRaw(String(clampDayOfMonth(dayOfMonthRaw)))}
                className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="eyebrow">Frequência</span>
            <div className="grid grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1">
              {(['monthly', 'yearly'] as const).map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFrequency(f)}
                  aria-pressed={frequency === f}
                  className={cn(
                    'h-9 rounded-sm text-sm font-medium transition-colors',
                    frequency === f ? 'bg-bg-surface text-fg1 shadow-sm' : 'text-fg3 hover:text-fg1',
                  )}
                >
                  {f === 'monthly' ? 'Mensal' : 'Anual'}
                </button>
              ))}
            </div>
          </label>

          {frequency === 'yearly' && (
            <MonthInput
              label="Mês do ano"
              value={anniversaryMonth}
              onChange={setAnniversaryMonth}
            />
          )}

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
            disabled={pending || !title.trim() || amountCents === 0 || !categoryId || payWith.endsWith(':')}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
