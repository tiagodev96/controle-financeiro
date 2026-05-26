'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { FormSelect } from './form-select';
import { MonthInput } from './month-input';

type Account = { id: string; name: string };
type Category = { id: string; name: string };

type Props = {
  accounts: Account[];
  categories: Category[];
  defaultMonth: string;
};

export function TransactionFilters({ accounts, categories, defaultMonth }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const status = params.get('status') ?? 'all';
  const conta = params.get('conta') ?? 'all';
  const categoria = params.get('categoria') ?? 'all';
  const mes = params.get('mes') ?? defaultMonth;
  const dataInicio = params.get('dataInicio') ?? '';
  const dataFim = params.get('dataFim') ?? '';
  const queryFromUrl = params.get('q') ?? '';

  // Modo de filtragem por data: "mês" (default) ou "intervalo".
  const [dateMode, setDateMode] = useState<'mes' | 'intervalo'>(
    dataInicio || dataFim ? 'intervalo' : 'mes',
  );
  const [searchInput, setSearchInput] = useState(queryFromUrl);

  function buildUrl(mutate: (next: URLSearchParams) => void): string {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    return `/transacoes${next.toString() ? `?${next}` : ''}`;
  }

  function setParam(key: string, value: string) {
    router.push(
      buildUrl((next) => {
        if (value === '' || value === 'all') next.delete(key);
        else next.set(key, value);
      }),
    );
  }

  function switchToMes() {
    setDateMode('mes');
    router.push(
      buildUrl((next) => {
        next.delete('dataInicio');
        next.delete('dataFim');
        if (!next.has('mes')) next.set('mes', defaultMonth);
      }),
    );
  }

  function switchToIntervalo() {
    setDateMode('intervalo');
    router.push(
      buildUrl((next) => {
        next.delete('mes');
      }),
    );
  }

  function submitSearch() {
    setParam('q', searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setParam('q', '');
  }

  const showsAllMonths = mes === 'all';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FormSelect
          label="Status"
          value={status}
          onChange={(v) => setParam('status', v)}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'pending', label: 'Pendente' },
            { value: 'paid', label: 'Pago' },
          ]}
        />

        <FormSelect
          label="Conta"
          value={conta}
          onChange={(v) => setParam('conta', v)}
          options={[
            { value: 'all', label: 'Todas' },
            ...accounts.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />

        <FormSelect
          label="Categoria"
          value={categoria}
          onChange={(v) => setParam('categoria', v)}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'none', label: '(sem categoria)' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Quando</span>
          <div className="grid grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-0.5 text-[10px] font-medium">
            <button
              type="button"
              onClick={switchToMes}
              aria-pressed={dateMode === 'mes'}
              className={
                dateMode === 'mes'
                  ? 'rounded-sm bg-bg-surface px-2 py-0.5 text-fg1 shadow-sm'
                  : 'rounded-sm px-2 py-0.5 text-fg3 hover:text-fg1'
              }
            >
              Mês
            </button>
            <button
              type="button"
              onClick={switchToIntervalo}
              aria-pressed={dateMode === 'intervalo'}
              className={
                dateMode === 'intervalo'
                  ? 'rounded-sm bg-bg-surface px-2 py-0.5 text-fg1 shadow-sm'
                  : 'rounded-sm px-2 py-0.5 text-fg3 hover:text-fg1'
              }
            >
              Intervalo
            </button>
          </div>
        </div>

        {dateMode === 'mes' ? (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <MonthInput
                value={showsAllMonths ? '' : mes}
                onChange={(next) => setParam('mes', next || defaultMonth)}
                disabled={showsAllMonths}
                placeholder="Todos os meses"
              />
            </div>
            <button
              type="button"
              onClick={() => setParam('mes', showsAllMonths ? defaultMonth : 'all')}
              aria-pressed={showsAllMonths}
              className={
                showsAllMonths
                  ? 'inline-flex h-11 shrink-0 items-center rounded-md border border-brand bg-brand-quiet-bg px-3 text-[11px] font-semibold text-brand-quiet-fg'
                  : 'inline-flex h-11 shrink-0 items-center rounded-md border border-border-soft bg-bg-inset px-3 text-[11px] font-medium text-fg3 hover:border-border-strong hover:text-fg1'
              }
            >
              Todos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-fg4">de</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setParam('dataInicio', e.target.value)}
                className="block min-h-11 w-full rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="mono text-[10px] uppercase tracking-wider text-fg4">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setParam('dataFim', e.target.value)}
                className="block min-h-11 w-full rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="eyebrow">Buscar descrição</span>
        <div className="flex items-center gap-2 rounded-md border border-border bg-bg-inset focus-within:ring-2 focus-within:ring-ring">
          <Search className="ml-3 size-3.5 shrink-0 text-fg4" strokeWidth={1.6} aria-hidden />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitSearch();
              }
            }}
            onBlur={() => {
              if (searchInput.trim() !== queryFromUrl) submitSearch();
            }}
            placeholder="Ex: mercado, jefferson, café"
            className="min-h-11 min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-fg1 placeholder:text-fg4 focus-visible:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpar busca"
              className="mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg3 hover:bg-bg-raised hover:text-fg1"
            >
              <X className="size-3.5" strokeWidth={1.6} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
