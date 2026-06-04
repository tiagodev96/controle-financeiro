import type { Currency } from './index';
import type { RatePoint } from './history';

export const DEFAULT_WINDOW_DAYS = 90;
const HIGH_THRESHOLD = 0.7;
const LOW_THRESHOLD = 0.3;

export type ConversionSignal =
  | 'convert_eur_to_brl'
  | 'convert_brl_to_eur'
  | 'neutral';

export type ConversionRecord = {
  fromCurrency: Currency;
  toCurrency: Currency;
  fromAmountCents: number;
  toAmountCents: number;
  effectiveRate: number;
  midMarketRate: number | null;
  convertedOn: string;
};

export type LastComparison = {
  convertedOn: string;
  effectiveRate: number;
  currentEstimatedRate: number;
  diffPct: number;
};

export type ConversionAdvice = {
  wiseSpreadPct: number | null;
  spreadSampleSize: number;
  currentEurBrl: number;
  currentBrlEur: number;
  netEurBrl: number;
  netBrlEur: number;
  windowPosition: number | null;
  windowLow: number | null;
  windowHigh: number | null;
  windowDays: number;
  signal: ConversionSignal;
  comparisonToLast: {
    eurToBrl: LastComparison | null;
    brlToEur: LastComparison | null;
  };
};

export type ConversionAdviceInput = {
  currentEurBrl: number;
  history: RatePoint[];
  conversions: ConversionRecord[];
  windowDays?: number;
  today?: string;
};

function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeSpread(conversions: ConversionRecord[]): {
  spread: number | null;
  sampleSize: number;
} {
  const withMid = conversions.filter(
    (c): c is ConversionRecord & { midMarketRate: number } =>
      c.midMarketRate !== null && c.midMarketRate > 0,
  );
  if (withMid.length === 0) return { spread: null, sampleSize: 0 };
  const sum = withMid.reduce(
    (acc, c) => acc + (c.midMarketRate - c.effectiveRate) / c.midMarketRate,
    0,
  );
  return { spread: sum / withMid.length, sampleSize: withMid.length };
}

function latestInDirection(
  conversions: ConversionRecord[],
  from: Currency,
  to: Currency,
): ConversionRecord | null {
  const matches = conversions
    .filter((c) => c.fromCurrency === from && c.toCurrency === to)
    .sort((a, b) => a.convertedOn.localeCompare(b.convertedOn));
  return matches[matches.length - 1] ?? null;
}

function comparison(
  record: ConversionRecord | null,
  currentEstimatedRate: number,
): LastComparison | null {
  if (!record) return null;
  return {
    convertedOn: record.convertedOn,
    effectiveRate: record.effectiveRate,
    currentEstimatedRate,
    diffPct: (currentEstimatedRate - record.effectiveRate) / record.effectiveRate,
  };
}

export function computeConversionAdvice(
  input: ConversionAdviceInput,
): ConversionAdvice {
  const { currentEurBrl, conversions } = input;
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;

  const windowed = input.today
    ? input.history.filter((p) => p.date >= daysBefore(input.today!, windowDays))
    : input.history;

  let windowPosition: number | null = null;
  let windowLow: number | null = null;
  let windowHigh: number | null = null;
  if (windowed.length >= 2) {
    const rates = windowed.map((p) => p.rate);
    windowLow = Math.min(...rates);
    windowHigh = Math.max(...rates);
    windowPosition =
      rates.filter((r) => r <= currentEurBrl).length / rates.length;
  }

  let signal: ConversionSignal = 'neutral';
  if (windowPosition !== null) {
    if (windowPosition >= HIGH_THRESHOLD) signal = 'convert_eur_to_brl';
    else if (windowPosition <= LOW_THRESHOLD) signal = 'convert_brl_to_eur';
  }

  const { spread, sampleSize } = computeSpread(conversions);
  const spreadFactor = 1 - (spread ?? 0);
  const currentBrlEur = 1 / currentEurBrl;
  const netEurBrl = currentEurBrl * spreadFactor;
  const netBrlEur = currentBrlEur * spreadFactor;

  return {
    wiseSpreadPct: spread,
    spreadSampleSize: sampleSize,
    currentEurBrl,
    currentBrlEur,
    netEurBrl,
    netBrlEur,
    windowPosition,
    windowLow,
    windowHigh,
    windowDays,
    signal,
    comparisonToLast: {
      eurToBrl: comparison(latestInDirection(conversions, 'EUR', 'BRL'), netEurBrl),
      brlToEur: comparison(latestInDirection(conversions, 'BRL', 'EUR'), netBrlEur),
    },
  };
}
