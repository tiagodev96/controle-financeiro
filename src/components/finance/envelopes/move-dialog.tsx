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
import { Num, type Currency } from '@/components/finance/num';
import {
  allocateToEnvelopeAction,
  withdrawFromEnvelopeAction,
} from '@/server/actions/envelopes/actions';

type Props = {
  envelopeId: string;
  envelopeName: string;
  currentCents: number;
  currency: Currency;
  mode: 'allocate' | 'withdraw';
  /** Prefill da alocação — usado pro aporte mensal combinado. */
  initialCents?: number;
  open: boolean;
  onOpenChange: (next: boolean) => void;
};

export function MoveEnvelopeDialog({
  envelopeId,
  envelopeName,
  currentCents,
  currency,
  mode,
  initialCents = 0,
  open,
  onOpenChange,
}: Props) {
  const [cents, setCents] = useState(mode === 'allocate' ? initialCents : 0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAllocate = mode === 'allocate';
  const title = isAllocate ? `Alocar pra ${envelopeName}` : `Devolver de ${envelopeName}`;
  const cta = isAllocate ? 'Alocar' : 'Devolver';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || cents <= 0) return;
    setPending(true);
    setError(null);

    const action = isAllocate ? allocateToEnvelopeAction : withdrawFromEnvelopeAction;
    const result = await action({ envelopeId, cents });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(isAllocate ? 'Valor alocado.' : 'Valor devolvido.');
    setCents(0);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
          <p className="text-[12px] text-fg3">
            Atual na caixinha:{' '}
            <Num cents={currentCents} currency={currency} className="text-fg2" />
          </p>

          <MoneyInput
            label="Valor"
            valueCents={cents}
            onChange={setCents}
            autoFocus
          />

          {error && (
            <p role="alert" className="text-sm text-money-negative">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || cents <= 0}
            className="block w-full min-h-11 rounded-md bg-brand px-3 py-2.5 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Salvando…' : cta}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
