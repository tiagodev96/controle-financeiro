'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Check, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { Num, type Currency } from '@/components/finance/num';
import { setReserveEnvelopeAction } from '@/server/actions/reserva/actions';
import { cn } from '@/lib/utils';

type EnvelopeOption = {
  id: string;
  name: string;
  currency: Currency;
  currentCents: number;
};

type Props = {
  envelopes: EnvelopeOption[];
  reserveId: string | null;
};

export function ReserveEnvelopePicker({ envelopes, reserveId }: Props) {
  const [pending, startTransition] = useTransition();

  function designate(envelopeId: string) {
    if (envelopeId === reserveId) return;
    startTransition(async () => {
      const result = await setReserveEnvelopeAction({ envelopeId });
      if (!result.ok) toast.error(result.error);
      else toast.success('Caixinha de reserva definida.');
    });
  }

  if (envelopes.length === 0) {
    return (
      <p className="rounded-md border border-border-soft bg-bg-surface p-4 text-center text-sm text-fg3">
        Crie uma{' '}
        <Link href="/caixinhas" className="text-brand underline-offset-2 hover:underline">
          caixinha
        </Link>{' '}
        pra usar como reserva.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {envelopes.map((e) => {
        const active = e.id === reserveId;
        return (
          <button
            key={e.id}
            type="button"
            disabled={pending}
            onClick={() => designate(e.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors disabled:opacity-60',
              active
                ? 'border-brand bg-bg-raised'
                : 'border-border-soft bg-bg-surface hover:border-border-strong',
            )}
          >
            <PiggyBank
              className={active ? 'size-4 text-brand' : 'size-4 text-fg3'}
              strokeWidth={1.6}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[15px] text-fg1">{e.name}</span>
            <Num cents={e.currentCents} currency={e.currency} className="text-[13px] text-fg2" />
            {active && <Check className="size-4 text-brand" strokeWidth={2} aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
