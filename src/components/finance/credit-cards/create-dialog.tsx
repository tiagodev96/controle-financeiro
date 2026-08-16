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
import { MoneyInput } from '@/components/finance/money-input';
import { FormSelect } from '@/components/finance/form-select';
import { createCreditCardAction } from '@/server/actions/credit-cards/actions';
import { bestPurchaseDay } from '@/lib/finance/credit-card';

type Account = { id: string; name: string; currency: 'EUR' | 'BRL' };

type Props = {
  accounts: Account[];
};

function clampDay(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 31) return 31;
  return Math.trunc(n);
}

export function CreateCreditCardDialog({ accounts }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [closingRaw, setClosingRaw] = useState('7');
  const [dueRaw, setDueRaw] = useState('11');
  const [limitCents, setLimitCents] = useState(0);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closingDay = clampDay(closingRaw);
  const dueDay = clampDay(dueRaw);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await createCreditCardAction({
      name,
      closingDay,
      dueDay,
      creditLimitCents: limitCents > 0 ? limitCents : null,
      paymentAccountId: accountId,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success('Cartão criado.');
    setName('');
    setLimitCents(0);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-brand px-3 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" strokeWidth={1.8} aria-hidden />
            Novo cartão
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo cartão</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <label className="block space-y-2">
            <span className="eyebrow">Nome</span>
            <input
              type="text"
              required
              autoFocus
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank"
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 placeholder:text-fg4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block space-y-2">
              <span className="eyebrow">Fecha dia</span>
              <input
                type="number"
                required
                min={1}
                max={31}
                value={closingRaw}
                onChange={(e) => setClosingRaw(e.target.value)}
                onBlur={() => setClosingRaw(String(clampDay(closingRaw)))}
                className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="block space-y-2">
              <span className="eyebrow">Vence dia</span>
              <input
                type="number"
                required
                min={1}
                max={31}
                value={dueRaw}
                onChange={(e) => setDueRaw(e.target.value)}
                onBlur={() => setDueRaw(String(clampDay(dueRaw)))}
                className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-sm text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
          </div>

          <p className="mono text-[10px] text-fg4">
            Melhor dia pra comprar: {bestPurchaseDay(closingDay)}
          </p>

          <FormSelect
            label="Conta que paga a fatura"
            required
            value={accountId}
            onChange={setAccountId}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
          />

          <MoneyInput label="Limite (opcional)" valueCents={limitCents} onChange={setLimitCents} />

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || !name.trim() || !accountId}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : 'Criar cartão'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
