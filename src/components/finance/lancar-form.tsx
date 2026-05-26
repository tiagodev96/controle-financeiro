'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { createTransaction } from '@/server/actions/transactions/create';
import { createCategoryAction } from '@/server/actions/categories/actions';
import { resolveCategoryIcon } from '@/lib/finance/category-icons';
import { MoneyInput } from './money-input';
import { Field } from './field';
import { CCY } from './ccy';
import { FormSelect } from './form-select';
import { Num } from './num';
import { cn } from '@/lib/utils';

type Account = { id: string; name: string; currency: 'BRL' | 'EUR' };
type Category = { id: string; name: string; icon: string | null };
type Direction = 'expense' | 'income';

type Props = {
  categories: Category[];
  accounts: Account[];
  lastAccountId: string | null;
  direction?: Direction;
};

function todayIsoDate(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

const COPY: Record<Direction, { cta: string; toast: string }> = {
  expense: {
    cta: 'Lançar despesa',
    toast: 'Despesa lançada.',
  },
  income: {
    cta: 'Lançar entrada',
    toast: 'Entrada lançada.',
  },
};

export function LancarForm({ categories, accounts, lastAccountId, direction = 'expense' }: Props) {
  const router = useRouter();

  const initialAccountId =
    (lastAccountId && accounts.some((a) => a.id === lastAccountId)
      ? lastAccountId
      : accounts[0]?.id) ?? '';
  const initialCategoryId = categories[0]?.id ?? '';
  const copy = COPY[direction];

  const [amountCents, setAmountCents] = useState(0);
  const [description, setDescription] = useState('');
  const [extraCategories, setExtraCategories] = useState<Category[]>([]);
  // Dedupe: revalidatePath após criar uma categoria pode trazê-la também via
  // prop `categories`. Mantém só a primeira ocorrência por id.
  const seenIds = new Set<string>();
  const visibleCategories: Category[] = [...categories, ...extraCategories].filter((c) => {
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingPending, setCreatingPending] = useState(false);
  const [accountId, setAccountId] = useState(initialAccountId);
  // Entrada é dinheiro recebido — default ON. Despesa é vencimento — default OFF.
  const [paid, setPaid] = useState(direction === 'income');
  const [updateBalance, setUpdateBalance] = useState(true);
  const [date, setDate] = useState(todayIsoDate);
  const [error, setError] = useState<string | null>(null);
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
      direction,
      paid,
      updateBalance,
      date,
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    toast.success(copy.toast);
    router.push('/transacoes');
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
          placeholder={direction === 'income' ? 'Ex: Salário maio' : 'Ex: Pão na padaria'}
          className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="eyebrow mb-2">Categoria</legend>
        <div className="flex flex-wrap gap-1.5">
          {visibleCategories.map((cat) => {
            const active = cat.id === categoryId;
            const Icon = resolveCategoryIcon(cat);
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
          {!creatingCategory && (
            <button
              type="button"
              onClick={() => setCreatingCategory(true)}
              aria-label="Criar nova categoria"
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-border-soft bg-transparent px-3 text-sm font-medium text-fg3 transition-colors hover:border-border-strong hover:text-fg1"
            >
              <Plus className="size-3.5" strokeWidth={1.8} aria-hidden />
              Nova
            </button>
          )}
        </div>
        {creatingCategory && (
          <div className="flex items-center gap-2 rounded-md border border-border-soft bg-bg-inset px-2 py-1.5">
            <input
              type="text"
              autoFocus
              maxLength={32}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nome da categoria"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setCreatingCategory(false);
                  setNewCategoryName('');
                }
              }}
              className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-fg1 placeholder:text-fg4 focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                const name = newCategoryName.trim();
                if (!name || creatingPending) return;
                setCreatingPending(true);
                const result = await createCategoryAction({ name, kind: direction });
                setCreatingPending(false);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                const created: Category = {
                  id: result.category.id,
                  name: result.category.name,
                  icon: result.category.icon ?? null,
                };
                setExtraCategories((prev) => [...prev, created]);
                setCategoryId(created.id);
                setNewCategoryName('');
                setCreatingCategory(false);
                toast.success('Categoria criada.');
              }}
              disabled={!newCategoryName.trim() || creatingPending}
              className="inline-flex h-7 items-center rounded-sm bg-brand px-2 text-[12px] font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              {creatingPending ? 'Salvando…' : 'Criar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatingCategory(false);
                setNewCategoryName('');
              }}
              className="inline-flex h-7 items-center rounded-sm px-2 text-[12px] text-fg3 hover:text-fg1"
            >
              Cancelar
            </button>
          </div>
        )}
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
              options={accounts.map((acc) => ({ value: acc.id, label: acc.name }))}
            />
          </div>
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
          <span className="text-sm font-medium text-fg1">
            {direction === 'income' ? 'Já recebido' : 'Já pago'}
          </span>
          <span className="mono text-[10px] text-fg4">
            {direction === 'income' ? 'entrada com status pago' : 'despesa com status pago'}
          </span>
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
            aria-label={direction === 'income' ? 'Já recebido' : 'Já pago'}
          />
          <span
            className={cn(
              'absolute top-0.5 size-4 rounded-full transition-all',
              paid ? 'left-4.5 bg-fg-on-brand' : 'left-0.5 bg-fg3',
            )}
          />
        </span>
      </button>

      {paid && (
        <button
          type="button"
          onClick={() => setUpdateBalance(!updateBalance)}
          aria-pressed={updateBalance}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-border-soft bg-bg-surface px-3.5 py-3 text-left transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-fg1">Atualizar saldo da conta</span>
            <span className="mono text-[10px] text-fg4">
              {direction === 'income' ? 'soma o valor no saldo' : 'desconta o valor do saldo'}
              {' · desligue se já ajustou manualmente'}
            </span>
          </span>
          <span
            className={cn(
              'relative inline-flex h-5.5 w-10 items-center rounded-full border transition-colors',
              updateBalance ? 'border-brand bg-brand' : 'border-border bg-bg-inset',
            )}
          >
            <input
              type="checkbox"
              name="updateBalance"
              checked={updateBalance}
              onChange={() => setUpdateBalance(!updateBalance)}
              className="sr-only"
              tabIndex={-1}
              aria-label="Atualizar saldo da conta"
            />
            <span
              className={cn(
                'absolute top-0.5 size-4 rounded-full transition-all',
                updateBalance ? 'left-4.5 bg-fg-on-brand' : 'left-0.5 bg-fg3',
              )}
            />
          </span>
        </button>
      )}

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
        <span>{pending ? 'Lançando…' : copy.cta}</span>
        {!pending && amountCents > 0 && selectedAccount && (
          <>
            <span aria-hidden className="text-fg-on-brand/60">·</span>
            <Num
              cents={amountCents}
              currency={selectedAccount.currency}
              className="text-fg-on-brand/90"
            />
          </>
        )}
      </button>
    </form>
  );
}
