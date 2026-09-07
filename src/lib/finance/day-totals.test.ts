import { describe, it, expect } from 'vitest';
import { sumDayTotals } from './day-totals';

describe('sumDayTotals', () => {
  it('U-DT1 — soma despesas e entradas do dia por moeda', () => {
    const totals = sumDayTotals([
      { direction: 'expense', amount_cents: 5000, currency: 'BRL' },
      { direction: 'expense', amount_cents: 20500, currency: 'BRL' },
      { direction: 'income', amount_cents: 1000, currency: 'BRL' },
    ]);
    expect(totals).toEqual([{ currency: 'BRL', expenseCents: 25500, incomeCents: 1000 }]);
  });

  it('U-DT2 — separa moedas e omite moeda sem movimento', () => {
    const totals = sumDayTotals([
      { direction: 'expense', amount_cents: 5000, currency: 'EUR' },
      { direction: 'expense', amount_cents: 3000, currency: 'BRL' },
    ]);
    expect(totals).toEqual([
      { currency: 'EUR', expenseCents: 5000, incomeCents: 0 },
      { currency: 'BRL', expenseCents: 3000, incomeCents: 0 },
    ]);
  });

  it('U-DT3 — transferências/conversões não entram (neutras no fluxo)', () => {
    const totals = sumDayTotals([
      { direction: 'expense', amount_cents: 5000, currency: 'BRL' },
      {
        direction: 'expense',
        amount_cents: 9999,
        currency: 'BRL',
        transfer: { fromCents: 1, fromCurrency: 'EUR', toCents: 2, toCurrency: 'BRL' },
      },
    ]);
    expect(totals).toEqual([{ currency: 'BRL', expenseCents: 5000, incomeCents: 0 }]);
  });

  it('U-DT4 — dia sem linhas relevantes retorna vazio', () => {
    expect(sumDayTotals([])).toEqual([]);
  });
});
