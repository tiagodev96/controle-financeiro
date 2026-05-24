export type Currency = 'EUR' | 'BRL';

/**
 * Formata centavos (inteiro) numa string PT-BR com símbolo da moeda.
 * Exemplos: formatMoney(120050, 'EUR') -> '€ 1.200,50'
 *           formatMoney(-87, 'BRL')    -> '-R$ 0,87'
 *
 * Por que centavos: dinheiro nunca em float (evita erros de ponto flutuante
 * em somas). Conversão pra display fica isolada aqui.
 */
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
