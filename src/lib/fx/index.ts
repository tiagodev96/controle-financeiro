import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { toIsoDate as isoDate } from '@/lib/dates';

export { convertCents } from './convert';
export {
  getRateHistory,
  getRateOn,
  computeFetchRange,
  type RatePoint,
  type GetRateHistoryInput,
  type GetRateOnInput,
} from './history';
export {
  computeConversionAdvice,
  type ConversionAdvice,
  type ConversionAdviceInput,
  type ConversionRecord,
  type ConversionSignal,
  type LastComparison,
} from './conversion-advice';

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest';
const STALE_DAYS = 7;

export type Currency = 'EUR' | 'BRL';

export class FxUnavailableError extends Error {
  constructor(message = 'Câmbio indisponível.') {
    super(message);
    this.name = 'FxUnavailableError';
  }
}

export type GetRateInput = {
  supabase: SupabaseClient<Database>;
  serviceSupabase: SupabaseClient<Database>;
  base: Currency;
  quote: Currency;
  when?: Date;
};

export type GetRateResult = {
  rate: number;
  rateDate: string;
  isStale: boolean;
};

function daysBefore(d: Date, days: number): string {
  const out = new Date(d);
  out.setDate(out.getDate() - days);
  return isoDate(out);
}

async function fetchFrankfurter(base: Currency, quote: Currency): Promise<number | null> {
  try {
    const url = `${FRANKFURTER_URL}?from=${base}&to=${quote}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json.rates?.[quote];
    return typeof rate === 'number' && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export async function getRate(input: GetRateInput): Promise<GetRateResult> {
  const when = input.when ?? new Date();
  const today = isoDate(when);

  // 1. Cache hit (hoje, par exato): retorna sem fetch.
  const { data: fresh } = await input.supabase
    .from('fx_rates_cache')
    .select('rate, rate_date')
    .eq('base', input.base)
    .eq('quote', input.quote)
    .eq('rate_date', today)
    .maybeSingle();

  if (fresh) {
    return { rate: Number(fresh.rate), rateDate: fresh.rate_date, isStale: false };
  }

  // 2. Cache miss: tenta fetch da frankfurter.
  const fetched = await fetchFrankfurter(input.base, input.quote);
  if (fetched !== null) {
    await input.serviceSupabase
      .from('fx_rates_cache')
      .upsert(
        { rate_date: today, base: input.base, quote: input.quote, rate: fetched },
        { onConflict: 'rate_date,base,quote' },
      );
    return { rate: fetched, rateDate: today, isStale: false };
  }

  // 3. Fetch falhou: tenta cache stale ≤ STALE_DAYS dias.
  const cutoff = daysBefore(when, STALE_DAYS);
  const { data: stale } = await input.supabase
    .from('fx_rates_cache')
    .select('rate, rate_date')
    .eq('base', input.base)
    .eq('quote', input.quote)
    .gte('rate_date', cutoff)
    .order('rate_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (stale) {
    return { rate: Number(stale.rate), rateDate: stale.rate_date, isStale: true };
  }

  throw new FxUnavailableError();
}

export type GetRateMapInput = {
  supabase: SupabaseClient<Database>;
  serviceSupabase: SupabaseClient<Database>;
  when?: Date;
};

export type RateMap = {
  EUR_BRL: number;
  BRL_EUR: number;
  rateDate: string;
  isStale: boolean;
};

export async function getRateMap(input: GetRateMapInput): Promise<RateMap> {
  const eurBrl = await getRate({
    supabase: input.supabase,
    serviceSupabase: input.serviceSupabase,
    base: 'EUR',
    quote: 'BRL',
    when: input.when,
  });
  return {
    EUR_BRL: eurBrl.rate,
    BRL_EUR: 1 / eurBrl.rate,
    rateDate: eurBrl.rateDate,
    isStale: eurBrl.isStale,
  };
}
