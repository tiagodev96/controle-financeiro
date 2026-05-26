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
  const abs = Math.abs(cents);
  const symbol = SYMBOL[currency];
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
 * grande (56px), fração média (28px) cinza. É a assinatura visual do
 * dashboard.
 */
export function HeroNumber({ cents, currency = 'EUR', className }: HeroProps) {
  const abs = Math.abs(cents) / 100;
  const [intPart, fracPart] = abs
    .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(',');
  const symbol = SYMBOL[currency];
  const isNegative = cents < 0;
  const accentColor = isNegative ? 'text-money-negative' : 'text-fg3';
  const intColor = isNegative ? 'text-money-negative' : 'text-fg1';

  return (
    <div className={cn('flex items-baseline gap-1.5', className)}>
      {isNegative && (
        <span className={cn('num text-[56px] font-bold leading-none tracking-[-0.035em]', intColor)}>
          −
        </span>
      )}
      <span className={cn('text-2xl font-medium leading-none tracking-tight', accentColor)}>
        {symbol}
      </span>
      <span className={cn('num text-[56px] font-bold leading-none tracking-[-0.035em]', intColor)}>
        {intPart}
      </span>
      <span className={cn('num text-[28px] font-medium leading-none tracking-tight', accentColor)}>
        ,{fracPart}
      </span>
    </div>
  );
}
