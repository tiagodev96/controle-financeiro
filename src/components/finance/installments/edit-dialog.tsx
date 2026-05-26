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
import { updateInstallmentPlanAction } from '@/server/actions/installments/actions';
import { splitInstallments } from '@/lib/finance/installments';
import type { Currency } from '@/components/finance/num';

type Category = { id: string; name: string; kind: 'expense' | 'income' };
type Account = { id: string; name: string; currency: Currency };

type Props = {
  planId: string;
  initialTitle: string;
  initialNotes: string | null;
  initialCategoryId: string | null;
  initialAccountId: string | null;
  initialTotalCents: number;
  initialTotalInstallments: number;
  initialFirstDueDate: string;
  initialFrequencyMonths: number;
  paidCount: number;
  planCurrency: Currency;
  categories: Category[];
  accounts: Account[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function EditInstallmentDialog({
  planId,
  initialTitle,
  initialNotes,
  initialCategoryId,
  initialAccountId,
  initialTotalCents,
  initialTotalInstallments,
  initialFirstDueDate,
  initialFrequencyMonths,
  paidCount,
  planCurrency,
  categories,
  accounts,
  open,
  onOpenChange,
}: Props) {
  const expenseCategories = categories.filter((c) => c.kind === 'expense');
  const compatibleAccounts = accounts.filter((a) => a.currency === planCurrency);

  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '');
  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [totalCents, setTotalCents] = useState(initialTotalCents);
  const [installmentsRaw, setInstallmentsRaw] = useState(String(initialTotalInstallments));
  const [firstDueDate, setFirstDueDate] = useState(initialFirstDueDate);
  const [frequencyRaw, setFrequencyRaw] = useState(String(initialFrequencyMonths));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Preview: simula como fica a primeira parcela pendente após salvar.
  const parts =
    totalCents > 0 && totalInstallments > paidCount
      ? splitInstallments(totalCents - 0, totalInstallments - paidCount)
      : [];
  const firstPreview = parts[0] ?? 0;
  const lastPreview = parts[parts.length - 1] ?? 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await updateInstallmentPlanAction({
      planId,
      title,
      notes: notes.trim() || null,
      categoryId: categoryId || undefined,
      accountId: accountId || undefined,
      totalAmountCents: totalCents,
      totalInstallments,
      firstDueDate,
      frequencyMonths,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Parcelado atualizado.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar parcelado</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          {paidCount > 0 && (
            <p className="text-[12px] text-fg3">
              {paidCount} parcela{paidCount === 1 ? '' : 's'} já paga{paidCount === 1 ? '' : 's'}{' '}
              · valor e datas das pagas são preservadas. Edição reconstrói só as pendentes.
            </p>
          )}

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
            <span className="eyebrow">Primeira parcela {paidCount > 0 && '(pendente)'}</span>
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
            <span className="eyebrow">Conta ({planCurrency})</span>
            <select
              aria-label="Conta"
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {compatibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {compatibleAccounts.length === 0 && (
              <p className="text-[11px] text-money-negative">
                Sem contas em {planCurrency} disponíveis.
              </p>
            )}
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

          {firstPreview > 0 && (
            <p className="text-[12px] text-fg3">
              Próximas pendentes: {(firstPreview / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {firstPreview !== lastPreview && (
                <> · última {(lastPreview / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
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
            disabled={pending || !title.trim() || !categoryId || !accountId || totalCents === 0}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
