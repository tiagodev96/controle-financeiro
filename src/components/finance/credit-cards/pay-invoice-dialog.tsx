'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormSelect } from '@/components/finance/form-select';
import { Num } from '@/components/finance/num';
import { payCardInvoiceAction } from '@/server/actions/credit-cards/actions';
import { toLocalIsoDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

type Account = { id: string; name: string; currency: 'EUR' | 'BRL' };

type Props = {
  cardId: string;
  cardName: string;
  dueOn: string;
  totalPendingCents: number;
  currency: 'EUR' | 'BRL';
  paymentAccountId: string;
  accounts: Account[];
};

function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function PayInvoiceDialog({
  cardId,
  cardName,
  dueOn,
  totalPendingCents,
  currency,
  paymentAccountId,
  accounts,
}: Props) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(paymentAccountId);
  const [paidOn, setPaidOn] = useState(() => toLocalIsoDate(new Date()));
  const [updateBalance, setUpdateBalance] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compra e débito na mesma moeda: só contas na moeda do cartão.
  const eligibleAccounts = accounts.filter((a) => a.currency === currency);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await payCardInvoiceAction({
      cardId,
      dueDate: dueOn,
      paidOn,
      accountId,
      updateBalance,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Fatura paga.');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md bg-brand px-2.5 text-[13px] font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Pagar fatura
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <div className="rounded-md border border-border-soft bg-bg-inset px-3 py-2.5">
            <p className="text-sm text-fg3">
              {cardName} · vencimento {shortDate(dueOn)}
            </p>
            <Num
              cents={totalPendingCents}
              currency={currency}
              className="num--stat text-fg1"
            />
          </div>

          <FormSelect
            label="Debitar da conta"
            required
            value={accountId}
            onChange={setAccountId}
            options={eligibleAccounts.map((a) => ({
              value: a.id,
              label: `${a.name} (${a.currency})`,
            }))}
          />

          <label className="block space-y-2">
            <span className="eyebrow">Data do pagamento</span>
            <input
              type="date"
              required
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <button
            type="button"
            onClick={() => setUpdateBalance(!updateBalance)}
            aria-pressed={updateBalance}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-border-soft bg-bg-surface px-3.5 py-3 text-left transition-colors hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-fg1">Atualizar saldo da conta</span>
              <span className="mono text-[10px] text-fg4">
                desconta o total do saldo · desligue se já ajustou manualmente
              </span>
            </span>
            <span
              className={cn(
                'relative inline-flex h-5.5 w-10 items-center rounded-full border transition-colors',
                updateBalance ? 'border-brand bg-brand' : 'border-border bg-bg-inset',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full transition-all',
                  updateBalance ? 'left-4.5 bg-fg-on-brand' : 'left-0.5 bg-fg3',
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
            disabled={pending || !accountId}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Pagando…' : 'Confirmar pagamento'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
