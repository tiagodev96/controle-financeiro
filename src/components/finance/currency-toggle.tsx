'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { setPreferredDisplayCurrencyAction } from '@/server/actions/profile/actions';
import { useCurrencySwitch } from './currency-switch';
import { cn } from '@/lib/utils';

type Props = {
  current: 'EUR' | 'BRL';
};

export function CurrencyToggle({ current }: Props) {
  // Derived state: quando o prop muda (porque outra instância no mesmo
  // render trocou a preferência via server action + revalidatePath), sincroniza
  // o estado local. Sem isso, as 2 instâncias na mesma página ficam dessincronizadas.
  const [prevCurrent, setPrevCurrent] = useState(current);
  const [optimistic, setOptimistic] = useState(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    setOptimistic(current);
  }
  // Transição compartilhada: enquanto troca, todo o conteúdo esmaece e os
  // toggles ficam travados (ver CurrencySwitchProvider no layout).
  const { switching, run } = useCurrencySwitch();

  function toggle() {
    const next: 'EUR' | 'BRL' = optimistic === 'EUR' ? 'BRL' : 'EUR';
    const previous = optimistic;
    setOptimistic(next);
    run(async () => {
      const result = await setPreferredDisplayCurrencyAction({ currency: next });
      if (!result.ok) {
        setOptimistic(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={switching}
      aria-label={`Trocar moeda principal (atual: ${optimistic})`}
      title="Trocar moeda principal"
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border-soft bg-bg-inset px-2 text-[11px] font-semibold uppercase tracking-wider text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {switching ? (
        <Loader2 aria-hidden className="size-3 animate-spin text-brand" strokeWidth={1.6} />
      ) : (
        <span aria-hidden className="text-fg4">ver em</span>
      )}
      <span>{optimistic === 'EUR' ? 'BRL' : 'EUR'}</span>
    </button>
  );
}
