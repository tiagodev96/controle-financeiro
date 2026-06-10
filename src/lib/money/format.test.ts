import { describe, it, expect } from 'vitest';
import {
  CURRENCY_SYMBOL,
  formatCents,
  formatCentsToBRL,
  formatNumberPtBR,
  formatRate,
} from './format';

describe('formatCentsToBRL', () => {
  it('F-1 — 0 cents vira "0,00"', () => {
    expect(formatCentsToBRL(0)).toBe('0,00');
  });

  it('F-2 — 1 cent vira "0,01"', () => {
    expect(formatCentsToBRL(1)).toBe('0,01');
  });

  it('F-3 — 1059 cents vira "10,59"', () => {
    expect(formatCentsToBRL(1059)).toBe('10,59');
  });

  it('F-4 — 105950 cents vira "1.059,50" com separador de milhar', () => {
    expect(formatCentsToBRL(105950)).toBe('1.059,50');
  });

  it('F-5 — 100000000 cents vira "1.000.000,00"', () => {
    expect(formatCentsToBRL(100000000)).toBe('1.000.000,00');
  });
});

describe('formatNumberPtBR', () => {
  it('F-6 — default 2 casas com separador de milhar', () => {
    expect(formatNumberPtBR(1240.5)).toBe('1.240,50');
  });

  it('F-7 — casas configuráveis', () => {
    expect(formatNumberPtBR(1240.5, 0)).toBe('1.241');
    expect(formatNumberPtBR(3.5, 1)).toBe('3,5');
  });
});

describe('formatCents', () => {
  it('F-8 — positivo com símbolo e espaço', () => {
    expect(formatCents(124050, 'EUR')).toBe('€ 1.240,50');
    expect(formatCents(124050, 'BRL')).toBe('R$ 1.240,50');
  });

  it('F-9 — negativo usa minus U+2212 antes do símbolo, nunca parênteses', () => {
    expect(formatCents(-60000, 'BRL')).toBe('−R$ 600,00');
  });

  it('F-10 — zero', () => {
    expect(formatCents(0, 'EUR')).toBe('€ 0,00');
  });
});

describe('formatRate', () => {
  it('F-11 — 2 casas por padrão', () => {
    expect(formatRate(6)).toBe('6,00');
    expect(formatRate(5.9678)).toBe('5,97');
  });

  it('F-12 — casas configuráveis', () => {
    expect(formatRate(5.9678, 4)).toBe('5,9678');
  });
});

describe('CURRENCY_SYMBOL', () => {
  it('F-13 — símbolos canônicos', () => {
    expect(CURRENCY_SYMBOL.EUR).toBe('€');
    expect(CURRENCY_SYMBOL.BRL).toBe('R$');
  });
});
