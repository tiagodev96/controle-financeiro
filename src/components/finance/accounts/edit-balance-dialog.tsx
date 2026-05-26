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
import { setAccountBalanceAction } from '@/server/actions/accounts/actions';
import type { Currency } from '@/components/finance/num';

type Props = {
  accountId: string;
  accountName: string;
  currency: Currency;
  currentBalanceCents: number;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function EditBalanceDialog({
  accountId,
  accountName,
  currency,
  currentBalanceCents,
  open,
  onOpenChange,
}: Props) {
  const [value, setValue] = useState(currentBalanceCents);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await setAccountBalanceAction({
      accountId,
      balanceCents: value,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Saldo atualizado.');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar saldo de {accountName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <p className="text-[12px] text-fg3">
            Saldo é manual. Atualize quando confirmar o valor real na conta — transactions pendentes
            entram só na projeção, não no saldo.
          </p>

          <MoneyInput
            label={`Saldo em ${currency}`}
            valueCents={value}
            onChange={setValue}
            autoFocus
            allowSign
          />

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
            {pending ? 'Salvando…' : 'Salvar saldo'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
