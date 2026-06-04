import { describe, it, expect } from 'vitest';
import {
  bandForMonths,
  monthsCovered,
  monthlyRecurringExpenseCents,
  median,
  monthlyEssential,
  bandLabel,
  bandCopy,
  type ReservaBand,
} from './reserva';

const ALL_BANDS: ReservaBand[] = [
  'sem_reserva',
  'em_formacao',
  'minima',
  'saudavel',
  'reforcada',
];

describe('bandForMonths', () => {
  it('U-RES-BAND1 — 0 meses → sem_reserva', () => {
    expect(bandForMonths(0)).toBe<ReservaBand>('sem_reserva');
  });

  it('U-RES-BAND2 — abaixo de 3 → em_formacao', () => {
    expect(bandForMonths(2.99)).toBe<ReservaBand>('em_formacao');
  });

  it('U-RES-BAND3 — exatamente 3 → minima', () => {
    expect(bandForMonths(3)).toBe<ReservaBand>('minima');
  });

  it('U-RES-BAND4 — entre 3 e 6 → minima', () => {
    expect(bandForMonths(5.99)).toBe<ReservaBand>('minima');
  });

  it('U-RES-BAND5 — exatamente 6 → saudavel', () => {
    expect(bandForMonths(6)).toBe<ReservaBand>('saudavel');
  });

  it('U-RES-BAND6 — entre 6 e 12 → saudavel', () => {
    expect(bandForMonths(11.99)).toBe<ReservaBand>('saudavel');
  });

  it('U-RES-BAND7 — exatamente 12 → reforcada', () => {
    expect(bandForMonths(12)).toBe<ReservaBand>('reforcada');
  });
});

describe('monthsCovered', () => {
  it('U-RES-COVER1 — reserva ÷ custo essencial', () => {
    expect(monthsCovered(600_000, 200_000)).toBeCloseTo(3, 5);
  });

  it('U-RES-COVER2 — custo essencial 0 → 0 (caller mostra estado vazio)', () => {
    expect(monthsCovered(600_000, 0)).toBe(0);
  });
});

describe('monthlyRecurringExpenseCents', () => {
  it('U-RES-RECUR — normaliza yearly ÷ 12 e soma monthly', () => {
    const cents = monthlyRecurringExpenseCents([
      { amountCents: 5_000, frequency: 'monthly' },
      { amountCents: 120_000, frequency: 'yearly' },
    ]);
    expect(cents).toBe(15_000);
  });
});

describe('median', () => {
  it('U-RES-MEDIAN1 — 1 valor', () => {
    expect(median([10])).toBe(10);
  });

  it('U-RES-MEDIAN2 — 2 valores (média dos dois)', () => {
    expect(median([10, 30])).toBe(20);
  });

  it('U-RES-MEDIAN3 — 3 valores fora de ordem (descarta extremos)', () => {
    expect(median([30, 10, 20])).toBe(20);
  });
});

describe('monthlyEssential', () => {
  it('U-RES-ESSENTIAL1 — com histórico: recorrente + mediana variável', () => {
    const result = monthlyEssential({
      recurringMonthlyCents: 15_000,
      variableMonthlyTotals: [10_000, 12_000, 8_000],
      hasEnoughHistory: true,
    });
    expect(result.cents).toBe(25_000);
    expect(result.variableCalibrating).toBe(false);
  });

  it('U-RES-ESSENTIAL2 — sem histórico (<3 meses): só recorrente, calibrando', () => {
    const result = monthlyEssential({
      recurringMonthlyCents: 15_000,
      variableMonthlyTotals: [10_000],
      hasEnoughHistory: false,
    });
    expect(result.cents).toBe(15_000);
    expect(result.variableCalibrating).toBe(true);
  });
});

describe('bandLabel / bandCopy', () => {
  it('U-RES-LABEL — toda faixa tem label sentence case não vazio', () => {
    for (const band of ALL_BANDS) {
      const label = bandLabel(band);
      expect(label.length).toBeGreaterThan(0);
      expect(label[0]).toBe(label[0]!.toUpperCase());
    }
  });

  it('U-RES-COPY — toda faixa tem copy não vazia e sem termos de gamificação', () => {
    const forbidden = /league|xp|streak|badge|trophy|quest|fincoin|score/i;
    for (const band of ALL_BANDS) {
      const copy = bandCopy(band);
      expect(copy.length).toBeGreaterThan(0);
      expect(copy).not.toMatch(forbidden);
    }
  });
});
