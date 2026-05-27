'use client';

import { useTransition } from 'react';
import { Zap } from 'lucide-react';
import { toast } from 'sonner';
import { generateRecurringForMonthAction } from '@/server/actions/recurring/actions';

export function GenerateMonthButton({ monthIso }: { monthIso: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await generateRecurringForMonthAction({ monthIso });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.created === 0 && result.skipped > 0) {
        toast.info('Tudo já lançado neste mês.');
      } else if (result.created === 0) {
        toast.info('Nenhuma regra ativa pra este mês.');
      } else {
        const word = result.created === 1 ? 'transação pendente' : 'transações pendentes';
        toast.success(`Geradas ${result.created} ${word}.`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-bg-inset px-3 text-sm font-medium text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Zap className="size-4" strokeWidth={1.6} aria-hidden />
      {pending ? 'Gerando…' : 'Gerar este mês'}
    </button>
  );
}
