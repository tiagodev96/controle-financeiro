'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTransaction } from '@/server/actions/transactions/create';
import { parseMoneyString } from '@/lib/money/parse';
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

  const [amountString, setAmountString] = useState('');
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

    let amountCents: number;
    try {
      amountCents = parseMoneyString(amountString);
    } catch {
      // Engolimos o tipo do erro porque o parser só lança em formato inválido
      // e a mensagem aqui é endereçada ao usuário, não ao log.
      setError('Informe um valor válido (ex: 12,50).');
      setPending(false);
      return;
    }

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
    // Pequeno delay pra o usuário enxergar o toast antes do redirect.
    setTimeout(() => router.push('/'), 800);
  }

  if (submitted) {
    return (
      <div
        role="status"
        className="rounded-md border border-paid-border bg-paid-bg p-4 text-fg1"
        style={{ borderColor: 'var(--paid-border)', background: 'var(--paid-bg)' }}
      >
        Despesa lançada.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <label className="block space-y-2">
        <span className="caption text-fg3">Valor</span>
        <input
          type="text"
          inputMode="decimal"
          name="valor"
          autoFocus
          required
          value={amountString}
          onChange={(e) => setAmountString(e.target.value)}
          placeholder="0,00"
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-base text-fg1 placeholder:text-fg4 font-numeric tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        />
      </label>

      <label className="block space-y-2">
        <span className="caption text-fg3">Descrição</span>
        <input
          type="text"
          name="descricao"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Pão na padaria"
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-base text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="caption text-fg3">Categoria</legend>
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
                  'min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  active
                    ? 'border-teal bg-teal text-on-primary'
                    : 'border-border bg-bg-inset text-fg2 hover:text-fg1'
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="caption text-fg3">Conta</span>
        <select
          name="conta"
          required
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-base text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.currency})
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="paid"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
          className="size-5 rounded border-border bg-bg-inset accent-teal"
        />
        <span className="text-fg1">Já pago</span>
      </label>

      <label className="block space-y-2">
        <span className="caption text-fg3">Data</span>
        <input
          type="date"
          name="data"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-base text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="block w-full min-h-11 rounded-md bg-teal px-3 py-3 font-semibold text-on-primary transition-colors hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Lançando...' : 'Lançar'}
      </button>
    </form>
  );
}
