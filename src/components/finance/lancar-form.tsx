'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTransaction } from '@/server/actions/transactions/create';
import { MoneyInput } from './money-input';
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
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                aria-pressed={active}
                className={cn(
                  'min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-brand bg-brand-quiet-bg text-brand-quiet-fg'
                    : 'border-border bg-bg-surface text-fg2 hover:border-border-strong hover:text-fg1',
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="eyebrow">Conta</span>
        <select
          name="conta"
          required
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.currency})
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm text-fg1">
          <input
            type="checkbox"
            name="paid"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="size-5 rounded border-border bg-bg-inset accent-brand"
          />
          <span>Já pago</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="eyebrow">Data</span>
          <input
            type="date"
            name="data"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-11 rounded-md border border-border bg-bg-inset px-2 py-1 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-money-negative">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block w-full min-h-11 rounded-md bg-brand px-3 py-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Lançando…' : 'Lançar despesa'}
      </button>
    </form>
  );
}
