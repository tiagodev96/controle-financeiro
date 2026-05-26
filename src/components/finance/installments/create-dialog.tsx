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
import { createInstallmentPlanAction } from '@/server/actions/installments/actions';

type Currency = 'EUR' | 'BRL';

type Category = { id: string; name: string; kind: 'expense' | 'income' };
type Account = { id: string; name: string; currency: Currency };

type Props = {
  categories: Category[];
  accounts: Account[];
};

function todayIsoDate(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export function CreateInstallmentDialog({ categories, accounts }: Props) {
  const expenseCategories = categories.filter((c) => c.kind === 'expense');

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [totalCents, setTotalCents] = useState(0);
  const [totalInstallments, setTotalInstallments] = useState(2);
  const [firstDueDate, setFirstDueDate] = useState(todayIsoDate);
  const [frequencyMonths, setFrequencyMonths] = useState(1);
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const currency: Currency = selectedAccount?.currency ?? 'EUR';
  const parcelaPreview = totalCents > 0 && totalInstallments > 0
    ? Math.ceil(totalCents / totalInstallments)
    : 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await createInstallmentPlanAction({
      title,
      totalAmountCents: totalCents,
      currency,
      totalInstallments,
      firstDueDate,
      frequencyMonths,
      categoryId,
      accountId,
      notes: notes.trim() || null,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Parcelado criado.');
    setTitle('');
    setTotalCents(0);
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
            Novo parcelado
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo parcelado</DialogTitle>
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
              placeholder="Ex: Notebook ou Sofá"
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <MoneyInput label="Valor total" valueCents={totalCents} onChange={setTotalCents} />

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block space-y-2">
              <span className="eyebrow">Parcelas</span>
              <input
                type="number"
                required
                min={2}
                max={60}
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(Math.max(2, Math.min(60, Number(e.target.value))))}
                className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="block space-y-2">
              <span className="eyebrow">A cada (meses)</span>
              <input
                type="number"
                required
                min={1}
                max={12}
                value={frequencyMonths}
                onChange={(e) => setFrequencyMonths(Math.max(1, Math.min(12, Number(e.target.value))))}
                className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="eyebrow">Primeira parcela</span>
            <input
              type="date"
              required
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <label className="block space-y-2">
            <span className="eyebrow">Categoria</span>
            <select
              aria-label="Categoria"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="eyebrow">Conta</span>
            <select
              aria-label="Conta"
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
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

          {parcelaPreview > 0 && (
            <p className="text-[12px] text-fg3">
              Parcela aproximada: ~{(parcelaPreview / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              pending ||
              !title.trim() ||
              totalCents === 0 ||
              !categoryId ||
              !accountId
            }
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Criar parcelado'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
