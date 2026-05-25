import { cn } from '@/lib/utils';
import type { Currency } from './num';

const DOT_COLOR: Record<Currency, string> = {
  EUR: 'bg-eur',
  BRL: 'bg-brl',
};

/**
 * CCY — tag pequena mono com dot indicador da moeda.
 * EUR vira brass, BRL vira sage. Pra diferenciar contas/transações multi-moeda.
 */
export function CCY({ code, className }: { code: Currency; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs border border-border-soft bg-bg-inset px-2 py-0.5 mono text-fg2',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', DOT_COLOR[code])} aria-hidden />
      {code}
    </span>
  );
}
