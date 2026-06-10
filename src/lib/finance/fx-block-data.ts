import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import {
  computeConversionAdvice,
  getRateHistory,
  getRateMapSafe,
  type ConversionAdvice,
  type ConversionRecord,
  type RatePoint,
} from '@/lib/fx';
import type { Database } from '@/types/database';
import { toIsoDate as isoDate } from '@/lib/dates';
import type { Currency } from '@/components/finance/num';

const HISTORY_DAYS = 365;

export type ConversionListItem = {
  id: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  fromAmountCents: number;
  toAmountCents: number;
  effectiveRate: number;
  midMarketRate: number | null;
  convertedOn: string;
  createdAt: string;
  note: string | null;
};

export type FxBlockData = {
  series: RatePoint[];
  rateDate: string | null;
  isStale: boolean;
  advice: ConversionAdvice;
  conversions: ConversionListItem[];
};

function daysBefore(d: Date, days: number): string {
  const out = new Date(d);
  out.setDate(out.getDate() - days);
  return isoDate(out);
}

export const getFxBlockData = cache(
  async (nowIso: string): Promise<FxBlockData | null> => {
    const supabase = (await getServerSupabase()) as SupabaseClient<Database>;
    const serviceSupabase = getServiceRoleSupabase();
    const now = new Date(nowIso);
    const today = isoDate(now);

    const series = await getRateHistory({
      supabase,
      serviceSupabase,
      base: 'EUR',
      quote: 'BRL',
      from: daysBefore(now, HISTORY_DAYS),
      to: today,
    });

    let currentEurBrl: number | null = null;
    let rateDate: string | null = null;
    let isStale = false;
    const map = await getRateMapSafe({ supabase, serviceSupabase, when: now });
    if (map) {
      currentEurBrl = map.EUR_BRL;
      rateDate = map.rateDate;
      isStale = map.isStale;
    } else {
      const last = series[series.length - 1];
      if (last) {
        currentEurBrl = last.rate;
        rateDate = last.date;
        isStale = true;
      }
    }

    if (currentEurBrl === null) return null;

    const { data } = await supabase
      .from('currency_conversions')
      .select(
        'id, from_currency, to_currency, from_amount_cents, to_amount_cents, effective_rate, mid_market_rate, converted_on, created_at, note',
      )
      .order('converted_on', { ascending: false })
      .order('created_at', { ascending: false });

    const conversions: ConversionListItem[] = (data ?? []).map((r) => ({
      id: r.id,
      fromCurrency: r.from_currency as Currency,
      toCurrency: r.to_currency as Currency,
      fromAmountCents: r.from_amount_cents,
      toAmountCents: r.to_amount_cents,
      effectiveRate: Number(r.effective_rate),
      midMarketRate: r.mid_market_rate === null ? null : Number(r.mid_market_rate),
      convertedOn: r.converted_on,
      createdAt: r.created_at,
      note: r.note,
    }));

    const records: ConversionRecord[] = conversions.map((c) => ({
      fromCurrency: c.fromCurrency,
      toCurrency: c.toCurrency,
      fromAmountCents: c.fromAmountCents,
      toAmountCents: c.toAmountCents,
      effectiveRate: c.effectiveRate,
      midMarketRate: c.midMarketRate,
      convertedOn: c.convertedOn,
      createdAt: c.createdAt,
    }));

    const advice = computeConversionAdvice({
      currentEurBrl,
      history: series,
      conversions: records,
      today,
    });

    return { series, rateDate, isStale, advice, conversions };
  },
);
