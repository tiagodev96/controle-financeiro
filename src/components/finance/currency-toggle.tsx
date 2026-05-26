'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setPreferredDisplayCurrencyAction } from '@/server/actions/profile/actions';
import { cn } from '@/lib/utils';

type Props = {
  current: 'EUR' | 'BRL';
};

export function CurrencyToggle({ current }: Props) {
  const [optimistic, setOptimistic] = useState(current);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next: 'EUR' | 'BRL' = optimistic === 'EUR' ? 'BRL' : 'EUR';
    setOptimistic(next);
    startTransition(async () => {
      const result = await setPreferredDisplayCurrencyAction({ currency: next });
      if (!result.ok) {
        setOptimistic(optimistic);
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={`Trocar moeda principal (atual: ${optimistic})`}
      title="Trocar moeda principal"
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-bg-inset px-2 text-[11px] font-semibold uppercase tracking-wider text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
      )}
    >
      <span aria-hidden className="text-fg4">ver em</span>
      <span>{optimistic === 'EUR' ? 'BRL' : 'EUR'}</span>
    </button>
  );
}
