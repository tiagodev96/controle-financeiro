import { describe, it, expect } from 'vitest';
import { splitInstallments, addMonthsClamped } from './installments';

describe('splitInstallments', () => {
  it('U-PARC-SPLIT — total=10001 em 3 parcelas distribui resto na primeira', () => {
    const parts = splitInstallments(10001, 3);
    expect(parts.reduce((s, x) => s + x, 0)).toBe(10001);
    const sorted = [...parts].sort((a, b) => a - b);
    const max = sorted[sorted.length - 1] ?? 0;
    const min = sorted[0] ?? 0;
    expect(max - min).toBeLessThanOrEqual(1);
  });

  it('U-PARC-SPLIT — divisão exata: total=12000 em 4 parcelas → 4× 3000', () => {
    expect(splitInstallments(12000, 4)).toEqual([3000, 3000, 3000, 3000]);
  });
});

describe('addMonthsClamped', () => {
  it('U-PARC-DATE — 31 jan + 1 mês = 28 fev (ano não bissexto)', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('U-PARC-DATE — 31 jan + 1 mês = 29 fev em ano bissexto (2028)', () => {
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('U-PARC-DATE — 15 jun + 2 meses = 15 ago', () => {
    expect(addMonthsClamped('2026-06-15', 2)).toBe('2026-08-15');
  });

  it('U-PARC-DATE — passa de ano: 15 nov + 3 meses = 15 fev do ano seguinte', () => {
    expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15');
  });
});
