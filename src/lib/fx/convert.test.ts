import { describe, it, expect } from 'vitest';
import { convertCents } from './convert';

describe('convertCents', () => {
  it('U-FX-CONV1 — multiplicação básica EUR→BRL', () => {
    expect(convertCents(100_00, 6.0)).toBe(600_00);
  });

  it('U-FX-CONV2 — arredonda HALF_EVEN: 0,5 cent vira par mais próximo', () => {
    expect(convertCents(5, 0.1)).toBe(0);
    expect(convertCents(15, 0.1)).toBe(2);
    expect(convertCents(25, 0.1)).toBe(2);
    expect(convertCents(35, 0.1)).toBe(4);
  });

  it('U-FX-CONV3 — zero passa cleanly', () => {
    expect(convertCents(0, 6.42)).toBe(0);
  });
});
