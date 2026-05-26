'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { marcarTransacaoComoPago } from '@/server/actions/transactions/mark-paid';
import { cn } from '@/lib/utils';

export function MarkPaidButton({ transactionId }: { transactionId: string }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function runMarkPaid(updateBalance: boolean): void {
    if (pending || done) return;
    setMenuOpen(false);
    startTransition(async () => {
      const result = await marcarTransacaoComoPago({ transactionId, updateBalance });
      if (result.ok) {
        setDone(true);
        toast.success(updateBalance ? 'Marcada e saldo atualizado.' : 'Marcada como paga.');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={pending || done}
        aria-label="Marcar como pago"
        aria-expanded={menuOpen}
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
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 top-9 z-40 min-w-55 rounded-md border border-border-soft bg-bg-raised py-1 shadow-md">
            <button
              type="button"
              onClick={() => runMarkPaid(true)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-fg1 hover:bg-bg-inset"
            >
              <span className="font-medium">Marcar e atualizar saldo</span>
              <span className="mono text-[10px] text-fg4">aplica o valor no saldo da conta</span>
            </button>
            <button
              type="button"
              onClick={() => runMarkPaid(false)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-fg1 hover:bg-bg-inset"
            >
              <span className="font-medium">Só marcar como paga</span>
              <span className="mono text-[10px] text-fg4">não mexe no saldo da conta</span>
            </button>
          </div>
        </>
      )}
    </span>
  );
}
