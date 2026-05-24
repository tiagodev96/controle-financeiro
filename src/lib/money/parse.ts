/**
 * Converte uma string monetária no padrão PT-BR estrito em centavos inteiros.
 *
 * Aceita:
 *   "12"          → 1200
 *   "12,5"        → 1250
 *   "12,50"       → 1250
 *   "0,50"        → 50
 *   "1.240,50"    → 124050
 *   "1.234.567,89"→ 123456789
 *
 * Rejeita (lança Error):
 *   "", "abc", "-12", "12.50" (ponto como decimal), "12,500" (3 decimais),
 *   "1.24,50" (separador de milhar inválido), múltiplas vírgulas.
 */
export function parseMoneyString(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new Error('Valor vazio');
  }

  // Estritamente PT-BR: opcional grupo de 1..3 dígitos seguido de ".ddd" repetido,
  // opcional ",dd" no fim (também aceita ,d).
  const pattern = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;
  const match = trimmed.match(pattern);
  if (!match) {
    throw new Error(`Valor inválido: "${input}"`);
  }

  const integerPart = match[1]!.replace(/\./g, '');
  const decimalPart = (match[2] ?? '').padEnd(2, '0');

  return Number.parseInt(integerPart, 10) * 100 + Number.parseInt(decimalPart, 10);
}
