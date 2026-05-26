import { describe, it, expect } from 'vitest';
import {
  computeDebtSuggestion,
  type SuggestionDebt,
  type SuggestionFxMap,
} from './debt-suggestion';

const debtEUR = (id: string, remainingCents: number, priority: 1 | 2 | 3 = 2): SuggestionDebt => ({
  id,
  title: `Dívida ${id}`,
  currency: 'EUR',
  priority,
  remainingCents,
});

const debtBRL = (id: string, remainingCents: number, priority: 1 | 2 | 3 = 2): SuggestionDebt => ({
  id,
  title: `Dívida ${id}`,
  currency: 'BRL',
  priority,
  remainingCents,
});

const rateMap: SuggestionFxMap = { EUR_BRL: 6.0, BRL_EUR: 1 / 6.0 };

describe('computeDebtSuggestion', () => {
  it('U-SUG1 — sem dívidas open retorna null', () => {
    expect(
      computeDebtSuggestion({ sobraEurCents: 50000, openDebts: [], fxRateMap: rateMap }),
    ).toBeNull();
  });

  it('U-SUG2 — sobra abaixo do ticket mínimo (< € 50) retorna null', () => {
    expect(
      computeDebtSuggestion({
        sobraEurCents: 4999,
        openDebts: [debtEUR('a', 100_000)],
        fxRateMap: rateMap,
      }),
    ).toBeNull();
  });

  it('U-SUG3 — dívida EUR, sobra × 0.6 ≤ remaining → suggested = sobra × 0.6', () => {
    const result = computeDebtSuggestion({
      sobraEurCents: 100_00,
      openDebts: [debtEUR('a', 200_00)],
      fxRateMap: rateMap,
    });
    expect(result?.suggestedCents).toBe(60_00);
    expect(result?.debt.id).toBe('a');
  });

  it('U-SUG4 — dívida EUR, sobra × 0.6 > remaining → suggested = remaining', () => {
    const result = computeDebtSuggestion({
      sobraEurCents: 500_00,
      openDebts: [debtEUR('a', 100_00)],
      fxRateMap: rateMap,
    });
    expect(result?.suggestedCents).toBe(100_00);
    expect(result?.percOfDebt).toBeCloseTo(1.0, 5);
  });

  it('U-SUG5 — múltiplas dívidas: prioriza priority asc + remaining desc', () => {
    const result = computeDebtSuggestion({
      sobraEurCents: 200_00,
      openDebts: [
        debtEUR('low', 1000_00, 3),
        debtEUR('high-small', 50_00, 1),
        debtEUR('high-big', 300_00, 1),
      ],
      fxRateMap: rateMap,
    });
    expect(result?.debt.id).toBe('high-big');
  });

  it('U-SUG6 — dívida BRL com fxRateMap: converte sobra pra BRL e retorna em BRL', () => {
    const result = computeDebtSuggestion({
      sobraEurCents: 100_00,
      openDebts: [debtBRL('a', 500_00)],
      fxRateMap: rateMap,
    });
    // sobra * 0.6 em BRL = € 60 * 6 = R$ 360 = 36000 cents
    expect(result?.suggestedCents).toBe(36000);
    expect(result?.debt.currency).toBe('BRL');
  });

  it('U-SUG7 — única dívida BRL sem fxRateMap retorna null', () => {
    expect(
      computeDebtSuggestion({
        sobraEurCents: 100_00,
        openDebts: [debtBRL('a', 500_00)],
        fxRateMap: null,
      }),
    ).toBeNull();
  });

  it('U-SUG8 — percOfDebt = suggestedCents / remaining na currency da dívida', () => {
    const result = computeDebtSuggestion({
      sobraEurCents: 100_00,
      openDebts: [debtEUR('a', 600_00)],
      fxRateMap: rateMap,
    });
    expect(result?.suggestedCents).toBe(60_00);
    expect(result?.percOfDebt).toBeCloseTo(0.1, 5);
  });
});
