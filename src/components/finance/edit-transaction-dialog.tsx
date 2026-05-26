'use client';

import { createElement, useState } from 'react';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyInput } from '@/components/finance/money-input';
import { Field } from '@/components/finance/field';
import { CCY } from '@/components/finance/ccy';
import { FormSelect } from '@/components/finance/form-select';
import { iconForCategory } from '@/lib/finance/category-icons';
import { updateTransactionAction } from '@/server/actions/transactions/update';
import type { Currency } from '@/components/finance/num';
import { cn } from '@/lib/utils';

type Direction = 'expense' | 'income';

type Category = {
  id: string;
  name: string;
  kind: 'expense' | 'income';
  is_archived: boolean;
};

type Account = {
  id: string;
  name: string;
  currency: Currency;
  is_archived: boolean;
};

type Transaction = {
  id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  direction: Direction;
  status: 'pending' | 'paid';
  occurred_on: string;
  paid_on: string | null;
  category_id: string | null;
  account_id: string;
};

type Props = {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  accounts: Account[];
};

export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
  categories,
  accounts,
}: Props) {
  // Derived state pattern: re-popula quando a transaction muda sem useEffect.
  const [prevTxnId, setPrevTxnId] = useState<string | null>(transaction?.id ?? null);
  const [amountCents, setAmountCents] = useState(transaction?.amount_cents ?? 0);
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.category_id ?? null);
  const [accountId, setAccountId] = useState(transaction?.account_id ?? '');
  const [paid, setPaid] = useState(transaction?.status === 'paid');
  const [date, setDate] = useState(transaction?.occurred_on ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (transaction && transaction.id !== prevTxnId) {
    setPrevTxnId(transaction.id);
    setAmountCents(transaction.amount_cents);
    setDescription(transaction.description);
    setCategoryId(transaction.category_id);
    setAccountId(transaction.account_id);
    setPaid(transaction.status === 'paid');
    setDate(transaction.occurred_on);
    setError(null);
  }

  if (!transaction) return null;

  const direction = transaction.direction;
  const visibleCategories = categories.filter(
    (c) => c.kind === direction && (!c.is_archived || c.id === categoryId),
  );
  const visibleAccounts = accounts.filter(
    (a) => !a.is_archived || a.id === accountId,
  );
  const selectedAccount = accounts.find((a) => a.id === accountId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !transaction) return;
    setPending(true);
    setError(null);

    const result = await updateTransactionAction({
      id: transaction.id,
      patch: {
        amountCents,
        description,
        categoryId: categoryId ?? undefined,
        accountId,
        paid,
        date,
      },
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Lançamento atualizado.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <MoneyInput
            label="Valor"
            valueCents={amountCents}
            onChange={setAmountCents}
          />

          <label className="block space-y-2">
            <span className="eyebrow">Descrição</span>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="eyebrow mb-2">Categoria</legend>
            <div className="flex flex-wrap gap-1.5">
              {visibleCategories.map((cat) => {
                const active = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                      active
                        ? 'border-brand/40 bg-brand-quiet-bg font-semibold text-brand-quiet-fg'
                        : 'border-border-soft bg-bg-inset font-medium text-fg2 hover:border-border-strong hover:text-fg1',
                    )}
                  >
                    {createElement(iconForCategory(cat.name), {
                      className: 'size-3.5',
                      strokeWidth: active ? 1.9 : 1.6,
                      'aria-hidden': true,
                    })}
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Conta">
              <div className="flex items-center gap-2">
                {selectedAccount && <CCY code={selectedAccount.currency} />}
                <FormSelect
                  bare
                  ariaLabel="Conta"
                  required
                  value={accountId}
                  onChange={setAccountId}
                  triggerClassName="border-0 bg-transparent min-h-0 py-0 px-0 hover:border-0 focus-visible:ring-0 text-sm font-medium"
                  options={visibleAccounts.map((acc) => ({ value: acc.id, label: acc.name }))}
                />
              </div>
            </Field>
            <Field label="Data">
              <label className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-fg3" strokeWidth={1.6} aria-hidden />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg1 focus-visible:outline-none"
                />
              </label>
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setPaid(!paid)}
            aria-pressed={paid}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-border-soft bg-bg-surface px-3.5 py-3 text-left transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-sm font-medium text-fg1">
              {direction === 'income' ? 'Já recebido' : 'Já pago'}
            </span>
            <span
              className={cn(
                'relative inline-flex h-5.5 w-10 items-center rounded-full border transition-colors',
                paid ? 'border-brand bg-brand' : 'border-border bg-bg-inset',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full transition-all',
                  paid ? 'left-4.5 bg-fg-on-brand' : 'left-0.5 bg-fg3',
                )}
              />
            </span>
          </button>

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
