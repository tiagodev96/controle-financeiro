'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Account = { id: string; name: string };

type Props = {
  accounts: Account[];
  defaultMonth: string;
};

export function TransactionFilters({ accounts, defaultMonth }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === '' || value === 'all') next.delete(key);
    else next.set(key, value);
    router.push(`/transacoes${next.toString() ? `?${next}` : ''}`);
  }

  const status = params.get('status') ?? 'all';
  const conta = params.get('conta') ?? 'all';
  const mes = params.get('mes') ?? defaultMonth;
  const showsAllMonths = mes === 'all';

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Status</span>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
          className="min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Todos</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Conta</span>
        <select
          aria-label="Conta"
          value={conta}
          onChange={(e) => setParam('conta', e.target.value)}
          className="min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Todas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="eyebrow">Mês</span>
        <div className="flex items-center gap-2">
          <input
            type="month"
            aria-label="Mês"
            value={showsAllMonths ? '' : mes}
            onChange={(e) => setParam('mes', e.target.value || defaultMonth)}
            disabled={showsAllMonths}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setParam('mes', showsAllMonths ? defaultMonth : 'all')}
            aria-pressed={showsAllMonths}
            className={
              showsAllMonths
                ? 'inline-flex h-8 items-center rounded-md border border-brand bg-brand-quiet-bg px-2 text-[11px] font-semibold text-brand-quiet-fg'
                : 'inline-flex h-8 items-center rounded-md border border-border-soft bg-bg-inset px-2 text-[11px] font-medium text-fg3 hover:border-border-strong hover:text-fg1'
            }
          >
            Todos
          </button>
        </div>
      </label>
    </div>
  );
}
