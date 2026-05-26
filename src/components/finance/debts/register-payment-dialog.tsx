'use client';

import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoneyInput } from '@/components/finance/money-input';
import { Field } from '@/components/finance/field';
import { CCY } from '@/components/finance/ccy';
import { Num, type Currency } from '@/components/finance/num';
import { registerDebtPaymentAction } from '@/server/actions/debts/actions';

type Account = {
  id: string;
  name: string;
  currency: Currency;
};

type Props = {
  debtId: string;
  debtTitle: string;
  remainingCents: number;
  currency: Currency;
  accounts: Account[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
  initialValueCents?: number;
};

function todayIsoDate(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export function RegisterPaymentDialog({
  debtId,
  debtTitle,
  remainingCents,
  currency,
  accounts,
  open,
  onOpenChange,
  initialValueCents,
}: Props) {
  const compatible = accounts.filter((a) => a.currency === currency);
  const initialAccountId = compatible[0]?.id ?? '';
  const initialAmount = Math.min(
    Math.max(initialValueCents ?? remainingCents, 0),
    remainingCents,
  );

  const [amount, setAmount] = useState(initialAmount);
  const [accountId, setAccountId] = useState(initialAccountId);
  const [date, setDate] = useState(todayIsoDate);
  const [description, setDescription] = useState(`Pagamento — ${debtTitle}`);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const clamped = Math.min(amount, remainingCents);
    const result = await registerDebtPaymentAction({
      debtId,
      amountCents: clamped,
      accountId,
      date,
      description,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(
      result.closedDebt ? 'Dívida quitada.' : 'Pagamento registrado.',
    );
    onOpenChange(false);
  }

  const noCompatible = compatible.length === 0;
  const selected = compatible.find((a) => a.id === accountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <div className="rounded-md border border-border-soft bg-bg-inset px-3 py-2 text-[12px] text-fg3">
            <span className="text-fg2">{debtTitle}</span>
            <span className="mx-1.5 text-fg5">·</span>
            <span>
              restante{' '}
              <Num cents={remainingCents} currency={currency} className="text-fg2" />
            </span>
          </div>

          {noCompatible ? (
            <p role="alert" className="rounded-md border border-status-overdue-fg/30 bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue-fg">
              Sem contas em {currency} — pagamento bloqueado.
            </p>
          ) : (
            <>
              <MoneyInput
                label="Valor"
                valueCents={amount}
                onChange={(v) => setAmount(Math.min(v, remainingCents))}
              />

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Conta">
                  <label className="flex items-center gap-2">
                    {selected && <CCY code={selected.currency} />}
                    <select
                      aria-label="Conta"
                      required
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg1 focus-visible:outline-none"
                    >
                      {compatible.map((acc) => (
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
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-fg1 focus-visible:outline-none"
                    />
                  </label>
                </Field>
              </div>

              <label className="block space-y-2">
                <span className="eyebrow">Descrição</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || noCompatible || amount === 0 || !accountId}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Registrar pagamento'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
