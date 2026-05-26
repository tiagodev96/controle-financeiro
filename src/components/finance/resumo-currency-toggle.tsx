'use client';

import { useRouter } from 'next/navigation';
import type { Currency } from './num';
import { cn } from '@/lib/utils';

type Props = {
  current: Currency;
  /** Resolve a URL pra moeda escolhida. Permite preservar outros params (ex: ?mes). */
  buildUrl: (nextMoeda: Currency) => string;
};

/**
 * Toggle EUR/BRL no /resumo. Variante URL-only do CurrencyToggle do
 * dashboard — não persiste preferência cross-session, só atualiza o param
 * da página atual. Esvazia se a tela perder o param ao navegar.
 */
export function ResumoCurrencyToggle({ current, buildUrl }: Props) {
  const router = useRouter();
  const other: Currency = current === 'EUR' ? 'BRL' : 'EUR';

  function toggle() {
    router.push(buildUrl(other));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Trocar moeda do resumo (atual: ${current})`}
      title="Trocar moeda do resumo"
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md border border-border-soft bg-bg-inset px-2 text-[11px] font-semibold uppercase tracking-wider text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span aria-hidden className="text-fg4">ver em</span>
      <span>{other}</span>
    </button>
  );
}
