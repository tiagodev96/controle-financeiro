'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
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
import {
  deleteCreditCardAction,
  updateCreditCardAction,
} from '@/server/actions/credit-cards/actions';

type Account = { id: string; name: string; currency: 'EUR' | 'BRL' };

type Props = {
  cardId: string;
  name: string;
  closingDay: number;
  dueDay: number;
  creditLimitCents: number | null;
  paymentAccountId: string;
  isArchived: boolean;
  accounts: Account[];
};

function clampDay(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > 31) return 31;
  return Math.trunc(n);
}

export function EditCreditCardDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.name);
  const [closingRaw, setClosingRaw] = useState(String(props.closingDay));
  const [dueRaw, setDueRaw] = useState(String(props.dueDay));
  const [limitCents, setLimitCents] = useState(props.creditLimitCents ?? 0);
  const [accountId, setAccountId] = useState(props.paymentAccountId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const result = await updateCreditCardAction({
      cardId: props.cardId,
      name,
      closingDay: clampDay(closingRaw),
      dueDay: clampDay(dueRaw),
      creditLimitCents: limitCents > 0 ? limitCents : null,
      paymentAccountId: accountId,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Cartão atualizado.');
    setOpen(false);
  }

  async function handleArchiveToggle() {
    if (pending) return;
    setPending(true);
    const result = await updateCreditCardAction({
      cardId: props.cardId,
      isArchived: !props.isArchived,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(props.isArchived ? 'Cartão reativado.' : 'Cartão arquivado.');
    setOpen(false);
  }

  async function handleDelete() {
    if (pending) return;
    // Confirmação leve: excluir some com o cartão; compras viram avulsas.
    if (!window.confirm(`Excluir o cartão "${props.name}"? As compras viram lançamentos avulsos.`)) {
      return;
    }
    setPending(true);
    const result = await deleteCreditCardAction({ cardId: props.cardId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('Cartão excluído.');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Editar cartão ${props.name}`}
            className="inline-flex size-8 items-center justify-center rounded-sm text-fg3 transition-colors hover:bg-bg-raised hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="size-4" strokeWidth={1.6} aria-hidden />
          </button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar cartão</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4" noValidate>
          <label className="block space-y-2">
            <span className="eyebrow">Nome</span>
            <input
              type="text"
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full min-h-11 rounded-md border border-border bg-bg-inset px-3 py-2 text-[15px] text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          <FormSelect
            label="Conta que paga a fatura"
            required
            value={accountId}
            onChange={setAccountId}
            options={props.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
          />

          <MoneyInput label="Limite (opcional)" valueCents={limitCents} onChange={setLimitCents} />

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
            {pending ? 'Salvando…' : 'Salvar'}
          </button>

          <div className="flex items-center justify-between gap-2 border-t border-border-soft pt-3">
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={pending}
              className="inline-flex min-h-9 items-center rounded-sm px-2 text-sm text-fg3 transition-colors hover:text-fg1 disabled:opacity-60"
            >
              {props.isArchived ? 'Reativar' : 'Arquivar'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex min-h-9 items-center rounded-sm px-2 text-sm text-money-negative transition-colors hover:opacity-80 disabled:opacity-60"
            >
              Excluir cartão
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
