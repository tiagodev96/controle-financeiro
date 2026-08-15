import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from './index';

const SERIES_BASE = 'https://api.frankfurter.dev/v1';

// Tolera gaps de fim de semana/feriado nas bordas antes de disparar um fetch.
// Sem isso, o gap de sábado→segunda re-buscaria a cada carga.
const GAP_TOLERANCE_DAYS = 5;

export type RatePoint = {
  date: string;
  rate: number;
};

export type GetRateHistoryInput = {
  supabase: SupabaseClient<Database>;
  serviceSupabase: SupabaseClient<Database>;
  base: Currency;
  quote: Currency;
  from: string;
  to: string;
};

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function computeFetchRange(
  cachedDates: string[],
  from: string,
  to: string,
  toleranceDays = GAP_TOLERANCE_DAYS,
): { start: string; end: string } | null {
  if (cachedDates.length === 0) return { start: from, end: to };

  const sorted = [...cachedDates].sort();
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;

  const needLeft = daysBetween(from, min) > toleranceDays;
  const needRight = daysBetween(max, to) > toleranceDays;

  if (needLeft && needRight) return { start: from, end: to };
  if (needLeft) return { start: from, end: min };
  if (needRight) return { start: max, end: to };
  return null;
}

async function fetchSeries(
  base: Currency,
  quote: Currency,
  start: string,
  end: string,
): Promise<RatePoint[] | null> {
  try {
    const url = `${SERIES_BASE}/${start}..${end}?from=${base}&to=${quote}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      rates?: Record<string, Record<string, number>>;
    };
    if (!json.rates) return null;
    return Object.entries(json.rates)
      .map(([date, byQuote]) => ({ date, rate: byQuote?.[quote] }))
      .filter((p): p is RatePoint => typeof p.rate === 'number' && p.rate > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    // Null degrada pro cache no caller; loga pra causa não sumir.
    console.error(`fx: série frankfurter ${base}/${quote} ${start}..${end} falhou`, err);
    return null;
  }
}

async function readCache(
  supabase: SupabaseClient<Database>,
  base: Currency,
  quote: Currency,
  from: string,
  to: string,
): Promise<RatePoint[]> {
  const { data } = await supabase
    .from('fx_rates_cache')
    .select('rate, rate_date')
    .eq('base', base)
    .eq('quote', quote)
    .gte('rate_date', from)
    .lte('rate_date', to)
    .order('rate_date', { ascending: true });

  return (data ?? []).map((r) => ({ date: r.rate_date, rate: Number(r.rate) }));
}

export async function getRateHistory(input: GetRateHistoryInput): Promise<RatePoint[]> {
  const { supabase, serviceSupabase, base, quote, from, to } = input;
  const cached = await readCache(supabase, base, quote, from, to);

  const range = computeFetchRange(
    cached.map((p) => p.date),
    from,
    to,
  );
  if (!range) return cached;

  const fetched = await fetchSeries(base, quote, range.start, range.end);
  if (!fetched || fetched.length === 0) return cached;

  await serviceSupabase.from('fx_rates_cache').upsert(
    fetched.map((p) => ({ rate_date: p.date, base, quote, rate: p.rate })),
    { onConflict: 'rate_date,base,quote' },
  );

  return readCache(supabase, base, quote, from, to);
}
