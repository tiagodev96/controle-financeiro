import { describe, it, expect } from 'vitest';
import { monthsToTarget, projectedTargetMonth } from './envelope-projection';

describe('monthsToTarget', () => {
  it('U-EP1 — arredonda pra cima: faltam 250 com aporte 100 → 3 meses', () => {
    expect(monthsToTarget(75_000, 100_000, 10_000)).toBe(3);
  });

  it('U-EP2 — exato: faltam 200 com aporte 100 → 2 meses', () => {
    expect(monthsToTarget(80_000, 100_000, 10_000)).toBe(2);
  });

  it('U-EP3 — sem meta ou sem aporte → null', () => {
    expect(monthsToTarget(10_000, null, 10_000)).toBeNull();
    expect(monthsToTarget(10_000, 100_000, null)).toBeNull();
    expect(monthsToTarget(10_000, 0, 10_000)).toBeNull();
  });

  it('U-EP4 — meta já atingida → null', () => {
    expect(monthsToTarget(100_000, 100_000, 10_000)).toBeNull();
    expect(monthsToTarget(150_000, 100_000, 10_000)).toBeNull();
  });
});

describe('projectedTargetMonth', () => {
  it('U-EP5 — 1 mês = o próprio mês; 3 meses cruza o ano', () => {
    expect(projectedTargetMonth('2026-06', 1)).toBe('2026-06');
    expect(projectedTargetMonth('2026-11', 3)).toBe('2027-01');
  });
});
