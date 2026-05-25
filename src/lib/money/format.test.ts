import { describe, it, expect } from 'vitest';
import { formatCentsToBRL } from './format';

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
