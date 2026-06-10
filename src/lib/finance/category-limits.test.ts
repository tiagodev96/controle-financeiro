import { describe, it, expect } from 'vitest';
import { projectLimitUsage } from './category-limits';

const FX = { EUR_BRL: 6, BRL_EUR: 1 / 6 };

describe('projectLimitUsage', () => {
  it('U-CL1 — mesma moeda: soma e detecta estouro', () => {
    expect(
      projectLimitUsage({
        limitCents: 35_000,
        spentCents: 30_000,
        limitCurrency: 'EUR',
        amountCents: 10_000,
        amountCurrency: 'EUR',
        fxRateMap: null,
      }),
    ).toEqual({ projectedCents: 40_000, exceeds: true });
  });

  it('U-CL2 — abaixo do limite não estoura', () => {
    expect(
      projectLimitUsage({
        limitCents: 35_000,
        spentCents: 10_000,
        limitCurrency: 'EUR',
        amountCents: 5_000,
        amountCurrency: 'EUR',
        fxRateMap: null,
      }),
    ).toEqual({ projectedCents: 15_000, exceeds: false });
  });

  it('U-CL3 — lançamento em moeda diferente converte pra moeda do limite', () => {
    // R$ 600,00 com BRL_EUR=1/6 → € 100,00.
    const result = projectLimitUsage({
      limitCents: 35_000,
      spentCents: 30_000,
      limitCurrency: 'EUR',
      amountCents: 60_000,
      amountCurrency: 'BRL',
      fxRateMap: FX,
    });
    expect(result).toEqual({ projectedCents: 40_000, exceeds: true });
  });

  it('U-CL4 — moeda diferente sem fx → null (sem aviso possível)', () => {
    expect(
      projectLimitUsage({
        limitCents: 35_000,
        spentCents: 30_000,
        limitCurrency: 'EUR',
        amountCents: 60_000,
        amountCurrency: 'BRL',
        fxRateMap: null,
      }),
    ).toBeNull();
  });

  it('U-CL5 — exatamente no limite não estoura', () => {
    expect(
      projectLimitUsage({
        limitCents: 35_000,
        spentCents: 30_000,
        limitCurrency: 'EUR',
        amountCents: 5_000,
        amountCurrency: 'EUR',
        fxRateMap: null,
      }),
    ).toEqual({ projectedCents: 35_000, exceeds: false });
  });
});
