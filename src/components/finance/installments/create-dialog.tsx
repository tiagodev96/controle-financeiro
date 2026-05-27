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
import { createInstallmentPlanAction } from '@/server/actions/installments/actions';
import { splitInstallments } from '@/lib/finance/installments';

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
  const [installmentsRaw, setInstallmentsRaw] = useState('2');
  const [firstDueDate, setFirstDueDate] = useState(todayIsoDate);
  const [frequencyRaw, setFrequencyRaw] = useState('1');
  const [categoryId, setCategoryId] = useState(expenseCategories[0]?.id ?? '');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const currency: Currency = selectedAccount?.currency ?? 'EUR';

  function clampInstallments(raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 2) return 2;
    if (n > 60) return 60;
    return Math.trunc(n);
  }
  function clampFrequency(raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    if (n > 12) return 12;
    return Math.trunc(n);
  }

  const totalInstallments = clampInstallments(installmentsRaw);
  const frequencyMonths = clampFrequency(frequencyRaw);

  const parcelaParts =
    totalCents > 0 && totalInstallments > 0
      ? splitInstallments(totalCents, totalInstallments)
      : [];
  const firstParcela = parcelaParts[0] ?? 0;
  const lastParcela = parcelaParts[parcelaParts.length - 1] ?? 0;

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
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-brand px-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                value={installmentsRaw}
                onChange={(e) => setInstallmentsRaw(e.target.value)}
                onBlur={() => setInstallmentsRaw(String(clampInstallments(installmentsRaw)))}
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
                value={frequencyRaw}
                onChange={(e) => setFrequencyRaw(e.target.value)}
                onBlur={() => setFrequencyRaw(String(clampFrequency(frequencyRaw)))}
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

          <FormSelect
            label="Categoria"
            required
            value={categoryId}
            onChange={setCategoryId}
            options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <FormSelect
            label="Conta"
            required
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
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

          {firstParcela > 0 && (
            <p className="text-[12px] text-fg3">
              {totalInstallments}× {(firstParcela / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {firstParcela !== lastParcela && (
                <> · última {(lastParcela / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
              )}
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
