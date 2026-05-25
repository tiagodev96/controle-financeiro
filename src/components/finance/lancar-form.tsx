'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { createTransaction } from '@/server/actions/transactions/create';
import { iconForCategory } from '@/lib/finance/category-icons';
import { MoneyInput } from './money-input';
import { Field } from './field';
import { CCY } from './ccy';
import { Num } from './num';
import { cn } from '@/lib/utils';

type Account = { id: string; name: string; currency: 'BRL' | 'EUR' };
type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  accounts: Account[];
  lastAccountId: string | null;
};

function todayIsoDate(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function ptDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const month = months[Number(m) - 1] ?? m;
  return `${d} ${month} ${y}`;
}

export function LancarForm({ categories, accounts, lastAccountId }: Props) {
  const router = useRouter();

  const initialAccountId =
    (lastAccountId && accounts.some((a) => a.id === lastAccountId)
      ? lastAccountId
      : accounts[0]?.id) ?? '';
  const initialCategoryId = categories[0]?.id ?? '';

  const [amountCents, setAmountCents] = useState(0);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [accountId, setAccountId] = useState(initialAccountId);
  const [paid, setPaid] = useState(false);
  const [date, setDate] = useState(todayIsoDate);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setPending(true);

    const result = await createTransaction({
      amountCents,
      description,
      categoryId,
      accountId,
      paid,
      date,
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    setSubmitted(true);
    setTimeout(() => router.push('/'), 800);
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-md border border-status-paid-fg/30 bg-status-paid-bg px-4 py-3 text-status-paid-fg"
      >
        Despesa lançada.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <MoneyInput
        label="Valor"
        name="valor"
        autoFocus
        valueCents={amountCents}
        onChange={setAmountCents}
      />

      <label className="block space-y-2">
        <span className="eyebrow">Descrição</span>
        <input
          type="text"
          name="descricao"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Pão na padaria"
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="eyebrow mb-2">Categoria</legend>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const active = cat.id === categoryId;
            const Icon = iconForCategory(cat.name);
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
                <Icon className="size-3.5" strokeWidth={active ? 1.9 : 1.6} aria-hidden />
                {cat.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Conta">
          <label className="flex items-center gap-2">
            {selectedAccount && <CCY code={selectedAccount.currency} />}
            <select
              name="conta"
              aria-label="Conta"
              required
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg1 focus-visible:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </label>
        </Field>
        <Field label="Data">
          <label className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-fg3" strokeWidth={1.6} aria-hidden />
            <input
              type="date"
              name="data"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg1 focus-visible:outline-none"
              aria-label={`Data: ${ptDate(date)}`}
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
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-fg1">Já pago</span>
          <span className="mono text-[10px] text-fg4">desconta do saldo da conta</span>
        </span>
        <span
          className={cn(
            'relative inline-flex h-5.5 w-10 items-center rounded-full border transition-colors',
            paid ? 'border-brand bg-brand' : 'border-border bg-bg-inset',
          )}
        >
          <input
            type="checkbox"
            name="paid"
            checked={paid}
            onChange={() => setPaid(!paid)}
            className="sr-only"
            tabIndex={-1}
            aria-label="Já pago"
          />
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
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3.5 text-[15px] font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{pending ? 'Lançando…' : 'Lançar despesa'}</span>
        {!pending && amountCents > 0 && selectedAccount && (
          <>
            <span aria-hidden className="opacity-50">·</span>
            <Num cents={amountCents} currency={selectedAccount.currency} />
          </>
        )}
      </button>
    </form>
  );
}
