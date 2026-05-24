import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formata centavos em EUR no padrão PT-BR', () => {
    expect(formatMoney(120050, 'EUR')).toBe('€ 1.200,50');
  });
});
