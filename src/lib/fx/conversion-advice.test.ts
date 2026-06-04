import { describe, it, expect } from 'vitest';
import { computeConversionAdvice, type ConversionRecord } from './conversion-advice';

const HISTORY = [
  { date: '2025-03-01', rate: 5.0 },
  { date: '2025-03-02', rate: 5.2 },
  { date: '2025-03-03', rate: 5.4 },
  { date: '2025-03-04', rate: 5.6 },
  { date: '2025-03-05', rate: 5.8 },
];

function eurToBrl(overrides: Partial<ConversionRecord> = {}): ConversionRecord {
  return {
    fromCurrency: 'EUR',
    toCurrency: 'BRL',
    fromAmountCents: 100_000,
    toAmountCents: 595_000,
    effectiveRate: 5.95,
    midMarketRate: 6.0,
    convertedOn: '2025-03-04',
    createdAt: '2025-03-04T10:00:00Z',
    ...overrides,
  };
}

function brlToEur(overrides: Partial<ConversionRecord> = {}): ConversionRecord {
  return {
    fromCurrency: 'BRL',
    toCurrency: 'EUR',
    fromAmountCents: 600_000,
    toAmountCents: 98_000,
    effectiveRate: 98_000 / 600_000,
    midMarketRate: 1 / 6,
    convertedOn: '2025-03-04',
    createdAt: '2025-03-04T10:00:00Z',
    ...overrides,
  };
}

describe('computeConversionAdvice', () => {
  it('sem conversões: spread null, sample 0, sem comparações', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 5.4,
      history: HISTORY,
      conversions: [],
    });
    expect(advice.wiseSpreadPct).toBeNull();
    expect(advice.spreadSampleSize).toBe(0);
    expect(advice.comparisonToLast.eurToBrl).toBeNull();
    expect(advice.comparisonToLast.brlToEur).toBeNull();
  });

  it('windowPosition no topo → sinal convert_eur_to_brl', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      history: HISTORY,
      conversions: [],
    });
    expect(advice.windowPosition).toBe(1);
    expect(advice.windowLow).toBe(5.0);
    expect(advice.windowHigh).toBe(5.8);
    expect(advice.signal).toBe('convert_eur_to_brl');
  });

  it('windowPosition no fundo → sinal convert_brl_to_eur', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 4.9,
      history: HISTORY,
      conversions: [],
    });
    expect(advice.windowPosition).toBe(0);
    expect(advice.signal).toBe('convert_brl_to_eur');
  });

  it('windowPosition no meio → neutro', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 5.4,
      history: HISTORY,
      conversions: [],
    });
    expect(advice.windowPosition).toBeCloseTo(0.6, 6);
    expect(advice.signal).toBe('neutral');
  });

  it('histórico curto (<2 pontos) → windowPosition null, neutro', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      history: [{ date: '2025-03-01', rate: 5.0 }],
      conversions: [],
    });
    expect(advice.windowPosition).toBeNull();
    expect(advice.signal).toBe('neutral');
  });

  it('spread médio das duas direções; net aplica o spread', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      history: HISTORY,
      conversions: [eurToBrl(), brlToEur()],
    });
    const spreadEur = (6.0 - 5.95) / 6.0;
    const spreadBrl = (1 / 6 - 98_000 / 600_000) / (1 / 6);
    const expected = (spreadEur + spreadBrl) / 2;
    expect(advice.wiseSpreadPct).toBeCloseTo(expected, 8);
    expect(advice.spreadSampleSize).toBe(2);
    expect(advice.netEurBrl).toBeCloseTo(6.0 * (1 - expected), 8);
    expect(advice.netBrlEur).toBeCloseTo((1 / 6) * (1 - expected), 8);
  });

  it('conversões sem mid_market_rate são ignoradas no spread', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      history: HISTORY,
      conversions: [eurToBrl({ midMarketRate: null })],
    });
    expect(advice.wiseSpreadPct).toBeNull();
    expect(advice.spreadSampleSize).toBe(0);
    expect(advice.netEurBrl).toBe(6.0);
    expect(advice.netBrlEur).toBeCloseTo(1 / 6, 8);
  });

  it('comparisonToLast pega a conversão mais recente de cada direção', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      history: HISTORY,
      conversions: [
        eurToBrl({ convertedOn: '2025-01-10', effectiveRate: 5.5 }),
        eurToBrl({ convertedOn: '2025-05-20', effectiveRate: 5.95 }),
        brlToEur({ convertedOn: '2025-04-01' }),
      ],
    });
    expect(advice.comparisonToLast.eurToBrl?.convertedOn).toBe('2025-05-20');
    expect(advice.comparisonToLast.eurToBrl?.effectiveRate).toBe(5.95);
    expect(advice.comparisonToLast.brlToEur?.convertedOn).toBe('2025-04-01');
  });

  it('comparisonToLast desempata mesma data pela hora de criação (createdAt)', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      history: HISTORY,
      conversions: [
        eurToBrl({ createdAt: '2025-03-04T09:00:00Z', effectiveRate: 5.5 }),
        eurToBrl({ createdAt: '2025-03-04T18:00:00Z', effectiveRate: 5.95 }),
      ],
    });
    expect(advice.comparisonToLast.eurToBrl?.effectiveRate).toBe(5.95);
  });

  it('comparisonToLast.diffPct positivo quando hoje rende mais que a última', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      history: HISTORY,
      conversions: [eurToBrl({ effectiveRate: 5.0, midMarketRate: null })],
    });
    const cmp = advice.comparisonToLast.eurToBrl!;
    expect(cmp.currentEstimatedRate).toBe(6.0);
    expect(cmp.diffPct).toBeCloseTo((6.0 - 5.0) / 5.0, 8);
  });

  it('filtra histórico pela janela quando today informado', () => {
    const advice = computeConversionAdvice({
      currentEurBrl: 6.0,
      today: '2025-03-05',
      windowDays: 2,
      history: HISTORY,
      conversions: [],
    });
    expect(advice.windowLow).toBe(5.4);
    expect(advice.windowHigh).toBe(5.8);
  });
});
