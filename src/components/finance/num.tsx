'use client';

import { cn } from '@/lib/utils';
import { formatCentsToBRL } from '@/lib/money/format';

const SYMBOL = { BRL: 'R$', EUR: '€' } as const;
export type Currency = 'BRL' | 'EUR';

type NumProps = {
  cents: number;
  currency?: Currency;
  sign?: boolean;
  className?: string;
};

/**
 * Num — número formatado PT-BR, tabular nums. Sem prefixo de sinal por
 * padrão (a cor — money-positive/money-negative — comunica a direção).
 * `sign` opcional renderiza um "+" para valores positivos quando você quer
 * enfatizar entrada (ex.: variação de sobra prevista positiva).
 *
 *   <Num cents={1250} />          → "€ 12,50"
 *   <Num cents={-1250} />         → "€ 12,50" (cor vermelha herdada do contexto)
 *   <Num cents={1250} sign />     → "+€ 12,50"
 */
export function Num({ cents, currency = 'EUR', sign = false, className }: NumProps) {
  const symbol = SYMBOL[currency];
  const abs = Math.abs(cents);
  const isNegative = cents < 0;
  const prefix = isNegative ? '−' : sign && cents > 0 ? '+' : '';
  return (
    <span
      className={cn(
        'num whitespace-nowrap',
        isNegative && 'text-money-negative',
        className,
      )}
    >
      {prefix}
      {symbol}
      &nbsp;
      {formatCentsToBRL(abs)}
    </span>
  );
}

type HeroProps = {
  cents: number;
  currency?: Currency;
  className?: string;
};

/**
 * HeroNumber — número-herói com split tipográfico: símbolo cinza, inteiro
 * grande, fração média cinza. É a assinatura visual do dashboard.
 *
 * Tipografia responsiva: 44/22/20 em viewport estreito (<640px) para
 * proteger valores de 7+ dígitos do overflow, e 56/28/24 (tamanhos
 * canônicos do design system) em sm+. `flex-wrap` como salvaguarda final
 * pra casos extremos.
 */
export function HeroNumber({ cents, currency = 'EUR', className }: HeroProps) {
  const symbol = SYMBOL[currency];

  const intClass =
    'num text-[44px] sm:text-[56px] font-bold leading-none tracking-[-0.035em]';
  const fracClass =
    'num text-[22px] sm:text-[28px] font-medium leading-none tracking-tight';
  const symbolClass =
    'text-[20px] sm:text-2xl font-medium leading-none tracking-tight';

  const [intPart, fracPart] = formatCentsToBRL(Math.abs(cents)).split(',');
  const isNegative = cents < 0;
  const accentColor = isNegative ? 'text-money-negative' : 'text-fg3';
  const intColor = isNegative ? 'text-money-negative' : 'text-fg1';

  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-1.5', className)}>
      {isNegative && <span className={cn(intClass, intColor)}>−</span>}
      <span className={cn(symbolClass, accentColor)}>{symbol}</span>
      <span className={cn(intClass, intColor)}>{intPart}</span>
      <span className={cn(fracClass, accentColor)}>,{fracPart}</span>
    </div>
  );
}
