type Currency = 'EUR' | 'BRL';

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  EUR: '€',
  BRL: 'R$',
};

export function formatNumberPtBR(value: number, fractionDigits = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatCentsToBRL(cents: number): string {
  return formatNumberPtBR(cents / 100);
}

/**
 * Valor monetário completo: "€ 1.240,50". Negativo com − (U+2212) antes do
 * símbolo — convenção do design system, nunca parênteses.
 */
export function formatCents(cents: number, currency: Currency): string {
  const minus = cents < 0 ? '−' : '';
  return `${minus}${CURRENCY_SYMBOL[currency]} ${formatNumberPtBR(Math.abs(cents) / 100)}`;
}

export function formatRate(rate: number, fractionDigits = 2): string {
  return formatNumberPtBR(rate, fractionDigits);
}
