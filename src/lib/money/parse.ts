export function parseMoneyString(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') {
    throw new Error('Valor vazio');
  }

  const pattern = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/;
  const match = trimmed.match(pattern);
  if (!match) {
    throw new Error(`Valor inválido: "${input}"`);
  }

  const integerPart = match[1]!.replace(/\./g, '');
  const decimalPart = (match[2] ?? '').padEnd(2, '0');

  return Number.parseInt(integerPart, 10) * 100 + Number.parseInt(decimalPart, 10);
}
