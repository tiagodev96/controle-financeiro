'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { marcarTransacaoComoPago } from '@/server/actions/transactions/mark-paid';
import { cn } from '@/lib/utils';

export function MarkPaidButton({ transactionId }: { transactionId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    if (pending || done) return;
    startTransition(async () => {
      const result = await marcarTransacaoComoPago({ transactionId });
      if (result.ok) {
        setDone(true);
        toast.success('Marcada como pago');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || done}
      aria-label="Marcar como pago"
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md border border-border-soft text-fg3 transition-colors hover:border-status-paid-fg/40 hover:bg-status-paid-bg hover:text-status-paid-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
        done && 'border-status-paid-fg/40 bg-status-paid-bg text-status-paid-fg',
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={1.6} aria-hidden />
      ) : (
        <Check className="size-4" strokeWidth={1.8} aria-hidden />
      )}
    </button>
  );
}
