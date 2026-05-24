import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formata centavos em EUR no padrão PT-BR', () => {
    expect(formatMoney(120050, 'EUR')).toBe('€ 1.200,50');
  });

  it('formata em BRL com prefixo R$', () => {
    expect(formatMoney(120050, 'BRL')).toBe('R$ 1.200,50');
  });

  it('aplica sinal de menos pra valores negativos', () => {
    expect(formatMoney(-87, 'BRL')).toBe('-R$ 0,87');
  });

  it('preserva zero à esquerda nos centavos', () => {
    expect(formatMoney(105, 'EUR')).toBe('€ 1,05');
  });
});
