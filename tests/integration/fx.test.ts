import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  getRate,
  getRateMap,
  FxUnavailableError,
} from '@/lib/fx';
import { getAuthedClient } from './helpers/auth';
import { getAdminClient } from './helpers/db';

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest';

const server = setupServer();

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function daysAgoIso(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function clearFxCache(): Promise<void> {
  const admin = getAdminClient();
  await admin.from('fx_rates_cache').delete().neq('rate_date', '1900-01-01');
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(async () => {
  server.resetHandlers();
  await clearFxCache();
});
afterEach(async () => {
  await clearFxCache();
});

describe('fx helpers (integração + MSW)', () => {
  const NOW = new Date();

  it('I-FX1 — cache hit hoje retorna sem chamar frankfurter', async () => {
    const admin = getAdminClient();
    let httpCalls = 0;
    server.use(
      http.get(FRANKFURTER_URL, () => {
        httpCalls += 1;
        return HttpResponse.json({ rates: { BRL: 6.5 } });
      }),
    );

    await admin.from('fx_rates_cache').insert({
      rate_date: todayIso(NOW),
      base: 'EUR',
      quote: 'BRL',
      rate: 6.0,
    });

    const supabase = await getAuthedClient();
    const result = await getRate({
      supabase,
      serviceSupabase: admin,
      base: 'EUR',
      quote: 'BRL',
      when: NOW,
    });

    expect(httpCalls).toBe(0);
    expect(result.rate).toBe(6.0);
    expect(result.isStale).toBe(false);
    expect(result.rateDate).toBe(todayIso(NOW));
  });

  it('I-FX2 — cache miss faz fetch, insere no cache e retorna', async () => {
    server.use(
      http.get(FRANKFURTER_URL, () =>
        HttpResponse.json({ amount: 1, base: 'EUR', date: todayIso(NOW), rates: { BRL: 6.42 } }),
      ),
    );

    const supabase = await getAuthedClient();
    const admin = getAdminClient();
    const result = await getRate({
      supabase,
      serviceSupabase: admin,
      base: 'EUR',
      quote: 'BRL',
      when: NOW,
    });

    expect(result.rate).toBe(6.42);
    expect(result.isStale).toBe(false);

    const { data: cached } = await admin
      .from('fx_rates_cache')
      .select('rate, rate_date, base, quote')
      .eq('rate_date', todayIso(NOW))
      .eq('base', 'EUR')
      .eq('quote', 'BRL')
      .single();
    expect(cached?.rate).toBe(6.42);
  });

  it('I-FX3 — fetch falha + cache stale ≤7 dias retorna isStale=true', async () => {
    server.use(
      http.get(FRANKFURTER_URL, () => HttpResponse.error()),
    );

    const admin = getAdminClient();
    await admin.from('fx_rates_cache').insert({
      rate_date: daysAgoIso(NOW, 3),
      base: 'EUR',
      quote: 'BRL',
      rate: 5.99,
    });

    const supabase = await getAuthedClient();
    const result = await getRate({
      supabase,
      serviceSupabase: admin,
      base: 'EUR',
      quote: 'BRL',
      when: NOW,
    });

    expect(result.rate).toBe(5.99);
    expect(result.isStale).toBe(true);
    expect(result.rateDate).toBe(daysAgoIso(NOW, 3));
  });

  it('I-FX4 — fetch falha + cache vazio lança FxUnavailableError', async () => {
    server.use(http.get(FRANKFURTER_URL, () => HttpResponse.error()));

    const supabase = await getAuthedClient();
    const admin = getAdminClient();

    await expect(
      getRate({
        supabase,
        serviceSupabase: admin,
        base: 'EUR',
        quote: 'BRL',
        when: NOW,
      }),
    ).rejects.toBeInstanceOf(FxUnavailableError);
  });

  it('I-FX5 — getRateMap retorna par com inversão BRL→EUR = 1/rate', async () => {
    const admin = getAdminClient();
    await admin.from('fx_rates_cache').insert({
      rate_date: todayIso(NOW),
      base: 'EUR',
      quote: 'BRL',
      rate: 6.0,
    });

    const supabase = await getAuthedClient();
    const map = await getRateMap({
      supabase,
      serviceSupabase: admin,
      when: NOW,
    });

    expect(map.EUR_BRL).toBe(6.0);
    expect(map.BRL_EUR).toBeCloseTo(1 / 6.0, 8);
    expect(map.isStale).toBe(false);
    expect(map.rateDate).toBe(todayIso(NOW));
  });
});
