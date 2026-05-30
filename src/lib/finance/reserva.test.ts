import { describe, it, expect } from 'vitest';
import {
  bandForMonths,
  debtCapForBand,
  reserveFactorForBand,
  monthsCovered,
  monthlyRecurringExpenseCents,
  median,
  monthlyEssential,
  computeReservaSuggestion,
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

describe('debtCapForBand', () => {
  it('U-RES-CAP — teto da dívida desce só nas faixas críticas', () => {
    expect(debtCapForBand('sem_reserva')).toBeCloseTo(0.3, 5);
    expect(debtCapForBand('em_formacao')).toBeCloseTo(0.45, 5);
    expect(debtCapForBand('minima')).toBeCloseTo(0.6, 5);
    expect(debtCapForBand('saudavel')).toBeCloseTo(0.6, 5);
    expect(debtCapForBand('reforcada')).toBeCloseTo(0.6, 5);
  });
});

describe('reserveFactorForBand', () => {
  it('U-RES-FACTOR — guarda mais quanto menos reserva; zero em reforcada', () => {
    expect(reserveFactorForBand('sem_reserva')).toBeCloseTo(0.7, 5);
    expect(reserveFactorForBand('em_formacao')).toBeCloseTo(0.55, 5);
    expect(reserveFactorForBand('minima')).toBeCloseTo(0.4, 5);
    expect(reserveFactorForBand('saudavel')).toBeCloseTo(0.2, 5);
    expect(reserveFactorForBand('reforcada')).toBeCloseTo(0, 5);
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

describe('computeReservaSuggestion', () => {
  it('U-RES-SUG1 — sem_reserva: 30% dívida / 70% reserva do restante', () => {
    const result = computeReservaSuggestion({
      sobraCents: 100_000,
      suggestedDebtCents: 30_000,
      reservaAllocatedCents: 0,
      monthlyEssentialCents: 200_000,
    });
    expect(result.band).toBe<ReservaBand>('sem_reserva');
    expect(result.toReserveCents).toBe(49_000);
    expect(result.toFreeCents).toBe(21_000);
    expect(result.mode).toBe('guardar');
  });

  it('U-RES-SUG2 — minima: dívida no teto 60%, reserva 40% do restante', () => {
    const result = computeReservaSuggestion({
      sobraCents: 100_000,
      suggestedDebtCents: 60_000,
      reservaAllocatedCents: 800_000,
      monthlyEssentialCents: 200_000,
    });
    expect(result.band).toBe<ReservaBand>('minima');
    expect(result.toReserveCents).toBe(16_000);
    expect(result.toFreeCents).toBe(24_000);
    expect(result.mode).toBe('guardar');
  });

  it('U-RES-SUG3 — reforcada: reserva 0, modo investir, todo o restante livre', () => {
    const result = computeReservaSuggestion({
      sobraCents: 100_000,
      suggestedDebtCents: 60_000,
      reservaAllocatedCents: 3_000_000,
      monthlyEssentialCents: 200_000,
    });
    expect(result.band).toBe<ReservaBand>('reforcada');
    expect(result.toReserveCents).toBe(0);
    expect(result.toFreeCents).toBe(40_000);
    expect(result.mode).toBe('investir');
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
