import { describe, it, expect } from 'vitest';
import { debtsClosedInMonth, type DebtRow } from './debts';

function debt(overrides: Partial<DebtRow>): DebtRow {
  return {
    id: 'd',
    title: 'Dívida',
    original_amount_cents: 100000,
    remaining_amount_cents: 0,
    currency: 'BRL',
    priority: 2,
    status: 'closed',
    notes: null,
    closed_at: null,
    target_quit_date: null,
    ...overrides,
  };
}

describe('debtsClosedInMonth', () => {
  const target = new Date(2026, 5, 9); // junho · 2026

  it('U-DBC1 — inclui dívida fechada dentro do mês alvo', () => {
    const result = debtsClosedInMonth(
      [debt({ id: 'a', closed_at: '2026-06-05T14:30:00+00:00' })],
      target,
    );
    expect(result.map((d) => d.id)).toEqual(['a']);
  });

  it('U-DBC2 — exclui dívida fechada em mês anterior', () => {
    const result = debtsClosedInMonth(
      [debt({ id: 'a', closed_at: '2026-05-31T23:00:00+00:00' })],
      target,
    );
    expect(result).toHaveLength(0);
  });

  it('U-DBC3 — exclui dívida fechada em mês posterior', () => {
    const result = debtsClosedInMonth(
      [debt({ id: 'a', closed_at: '2026-07-01T00:00:00+00:00' })],
      target,
    );
    expect(result).toHaveLength(0);
  });

  it('U-DBC4 — ignora dívida sem closed_at', () => {
    const result = debtsClosedInMonth([debt({ id: 'a', closed_at: null })], target);
    expect(result).toHaveLength(0);
  });

  it('U-DBC5 — borda: primeiro dia do mês entra, último instante do mês anterior não', () => {
    const result = debtsClosedInMonth(
      [
        debt({ id: 'in', closed_at: '2026-06-01T00:00:00+00:00' }),
        debt({ id: 'out', closed_at: '2026-05-31T22:00:00+00:00' }),
      ],
      target,
    );
    expect(result.map((d) => d.id)).toEqual(['in']);
  });
});
