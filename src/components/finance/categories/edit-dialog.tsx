'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateCategoryAction } from '@/server/actions/categories/actions';
import { IconPicker } from './icon-picker';
import { MoneyInput } from '@/components/finance/money-input';
import { cn } from '@/lib/utils';

type LimitCurrency = 'EUR' | 'BRL';

type Props = {
  categoryId: string;
  currentName: string;
  currentIcon: string | null;
  currentMonthlyLimitCents: number | null;
  currentLimitCurrency: LimitCurrency | null;
  /** Outros pode trocar ícone mas não pode renomear. */
  nameLocked?: boolean;
  /** Só categorias expense suportam limite. */
  isExpenseKind?: boolean;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function EditCategoryDialog({
  categoryId,
  currentName,
  currentIcon,
  currentMonthlyLimitCents,
  currentLimitCurrency,
  nameLocked = false,
  isExpenseKind = true,
  open,
  onOpenChange,
}: Props) {
  const [name, setName] = useState(currentName);
  const [icon, setIcon] = useState<string | null>(currentIcon);
  const [monthlyLimitCents, setMonthlyLimitCents] = useState(currentMonthlyLimitCents ?? 0);
  const [limitCurrency, setLimitCurrency] = useState<LimitCurrency>(currentLimitCurrency ?? 'EUR');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const hasLimit = isExpenseKind && monthlyLimitCents > 0;
    const result = await updateCategoryAction({
      categoryId,
      patch: {
        name: nameLocked ? undefined : name,
        icon,
        monthlyLimitCents: isExpenseKind
          ? hasLimit ? monthlyLimitCents : null
          : undefined,
        limitCurrency: isExpenseKind
          ? hasLimit ? limitCurrency : null
          : undefined,
      },
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Categoria atualizada.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <label className="block space-y-2">
            <span className="eyebrow">Nome</span>
            <input
              type="text"
              required
              autoFocus={!nameLocked}
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={nameLocked}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />
            {nameLocked && (
              <span className="text-[11px] text-fg4">Categoria de backup, nome não pode ser alterado.</span>
            )}
          </label>

          <IconPicker value={icon} onChange={setIcon} />

          {isExpenseKind && (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
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
            disabled={pending || (!nameLocked && !name.trim())}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
