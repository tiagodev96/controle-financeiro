import { describe, it, expect } from 'vitest';
import { compareMonths, type MonthFlow } from './month-comparison';

function flow(overrides: Partial<MonthFlow> = {}): MonthFlow {
  return {
    incomeCents: 300_000,
    expenseCents: 200_000,
    topCategories: [],
    ...overrides,
  };
}

describe('compareMonths', () => {
  it('U-MC1 — entrada maior é good, com pct sobre a base anterior', () => {
    const result = compareMonths(flow({ incomeCents: 330_000 }), flow({ incomeCents: 300_000 }));
    expect(result.income).toEqual({ diffCents: 30_000, pct: 0.1, direction: 'good' });
  });

  it('U-MC2 — despesa maior é bad; despesa menor é good', () => {
    const up = compareMonths(flow({ expenseCents: 250_000 }), flow({ expenseCents: 200_000 }));
    expect(up.expense.direction).toBe('bad');
    expect(up.expense.diffCents).toBe(50_000);

    const down = compareMonths(flow({ expenseCents: 150_000 }), flow({ expenseCents: 200_000 }));
    expect(down.expense.direction).toBe('good');
    expect(down.expense.diffCents).toBe(-50_000);
    expect(down.expense.pct).toBeCloseTo(-0.25);
  });

  it('U-MC3 — sobra compara o líquido (entrada − despesa) dos dois meses', () => {
    // Atual: 300k − 180k = 120k; anterior: 300k − 200k = 100k.
    const result = compareMonths(flow({ expenseCents: 180_000 }), flow());
    expect(result.sobra).toEqual({ diffCents: 20_000, pct: 0.2, direction: 'good' });
  });

  it('U-MC4 — sem mudança é neutral com diff 0', () => {
    const result = compareMonths(flow(), flow());
    expect(result.income.direction).toBe('neutral');
    expect(result.expense.diffCents).toBe(0);
    expect(result.sobra.direction).toBe('neutral');
  });

  it('U-MC5 — base anterior < € 1,00 suprime o percentual (pct null)', () => {
    const result = compareMonths(
      flow({ expenseCents: 50_000 }),
      flow({ expenseCents: 50, incomeCents: 0 }),
    );
    expect(result.expense.pct).toBeNull();
    expect(result.expense.diffCents).toBe(49_950);
    expect(result.income.pct).toBeNull();
  });

  it('U-MC6 — sobra anterior negativa: base do pct é o valor absoluto', () => {
    // Anterior: −50k; atual: +10k → diff 60k, pct 1.2 sobre |−50k|.
    const result = compareMonths(
      flow({ incomeCents: 210_000, expenseCents: 200_000 }),
      flow({ incomeCents: 150_000, expenseCents: 200_000 }),
    );
    expect(result.sobra.diffCents).toBe(60_000);
    expect(result.sobra.pct).toBeCloseTo(1.2);
    expect(result.sobra.direction).toBe('good');
  });

  it('U-MC7 — categorias casadas por nome; nova compara contra 0; sumida não lista', () => {
    const result = compareMonths(
      flow({
        topCategories: [
          { name: 'Mercado', totalCents: 60_000 },
          { name: 'Pet', totalCents: 20_000 },
        ],
      }),
      flow({
        topCategories: [
          { name: 'Mercado', totalCents: 50_000 },
          { name: 'Restaurante', totalCents: 30_000 },
        ],
      }),
    );
    expect(result.categories).toEqual([
      { name: 'Mercado', currentCents: 60_000, previousCents: 50_000, diffCents: 10_000 },
      { name: 'Pet', currentCents: 20_000, previousCents: 0, diffCents: 20_000 },
    ]);
  });
});
