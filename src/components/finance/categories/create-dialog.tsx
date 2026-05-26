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
import { createCategoryAction } from '@/server/actions/categories/actions';
import { IconPicker } from './icon-picker';
import { MoneyInput } from '@/components/finance/money-input';
import { cn } from '@/lib/utils';

type Kind = 'expense' | 'income';
type LimitCurrency = 'EUR' | 'BRL';

export function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('expense');
  const [icon, setIcon] = useState<string | null>(null);
  const [monthlyLimitCents, setMonthlyLimitCents] = useState(0);
  const [limitCurrency, setLimitCurrency] = useState<LimitCurrency>('EUR');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const hasLimit = kind === 'expense' && monthlyLimitCents > 0;
    const result = await createCategoryAction({
      name,
      kind,
      icon,
      monthlyLimitCents: hasLimit ? monthlyLimitCents : null,
      limitCurrency: hasLimit ? limitCurrency : null,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Categoria criada.');
    setName('');
    setKind('expense');
    setIcon(null);
    setMonthlyLimitCents(0);
    setLimitCurrency('EUR');
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
            Nova categoria
          </button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <label className="block space-y-2">
            <span className="eyebrow">Tipo</span>
            <div className="grid grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1">
              {(['expense', 'income'] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    'h-9 rounded-sm text-sm font-medium transition-colors',
                    kind === k ? 'bg-bg-surface text-fg1 shadow-sm' : 'text-fg3 hover:text-fg1',
                  )}
                >
                  {k === 'expense' ? 'Despesa' : 'Entrada'}
                </button>
              ))}
            </div>
          </label>

          <label className="block space-y-2">
            <span className="eyebrow">Nome</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'income' ? 'Ex: Bônus' : 'Ex: Streaming'}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <IconPicker value={icon} onChange={setIcon} />

          {kind === 'expense' && (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <MoneyInput
                  label="Limite mensal (opcional)"
                  valueCents={monthlyLimitCents}
                  onChange={setMonthlyLimitCents}
                />
                <div className="grid h-13 grid-cols-2 gap-0.5 rounded-md border border-border-soft bg-bg-inset p-1">
                  {(['EUR', 'BRL'] as const).map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setLimitCurrency(c)}
                      aria-pressed={limitCurrency === c}
                      className={cn(
                        'rounded-sm px-2 text-xs font-medium transition-colors',
                        limitCurrency === c ? 'bg-bg-surface text-fg1 shadow-sm' : 'text-fg3 hover:text-fg1',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-fg4">
                Conta gastos em EUR + BRL convertidos pra moeda escolhida. Alerta a 80%. Deixe 0 pra desabilitar.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Criar categoria'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
