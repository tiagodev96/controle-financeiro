export type Currency = 'EUR' | 'BRL';

export function formatMoney(amountInCents: number, currency: Currency): string {
  const sign = amountInCents < 0 ? '-' : '';
  const abs = Math.abs(amountInCents);
  const reais = Math.floor(abs / 100);
  const cents = abs % 100;

  const reaisFormatted = reais
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const centsFormatted = cents.toString().padStart(2, '0');
  const symbol = currency === 'EUR' ? '€' : 'R$';

  return `${sign}${symbol} ${reaisFormatted},${centsFormatted}`;
}
