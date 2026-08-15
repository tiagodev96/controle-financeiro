import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { getRateHistory } from '@/lib/fx';
import { getAuthedClient } from './helpers/auth';
import { getAdminClient } from './helpers/db';

const SERIES_URL = 'https://api.frankfurter.dev/v1/:range';

const server = setupServer();

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

describe('getRateHistory (integração + MSW)', () => {
  it('I-FXH1 — cache vazio: busca série, faz upsert e retorna pontos ordenados', async () => {
    let httpCalls = 0;
    server.use(
      http.get(SERIES_URL, () => {
        httpCalls += 1;
        return HttpResponse.json({
          amount: 1,
          base: 'EUR',
          start_date: '2025-01-01',
          end_date: '2025-01-05',
          rates: {
            '2025-01-03': { BRL: 6.1 },
            '2025-01-01': { BRL: 6.0 },
            '2025-01-02': { BRL: 6.05 },
          },
        });
      }),
    );

    const supabase = await getAuthedClient();
    const admin = getAdminClient();
    const series = await getRateHistory({
      supabase,
      serviceSupabase: admin,
      base: 'EUR',
      quote: 'BRL',
      from: '2025-01-01',
      to: '2025-01-05',
    });

    expect(httpCalls).toBe(1);
    expect(series.map((p) => p.date)).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(series.map((p) => p.rate)).toEqual([6.0, 6.05, 6.1]);

    const { data: cached } = await admin
      .from('fx_rates_cache')
      .select('rate_date')
      .eq('base', 'EUR')
      .eq('quote', 'BRL');
    expect(cached).toHaveLength(3);
  });

  it('I-FXH2 — cache cobre o intervalo: não chama frankfurter', async () => {
    let httpCalls = 0;
    server.use(
      http.get(SERIES_URL, () => {
        httpCalls += 1;
        return HttpResponse.json({ rates: {} });
      }),
    );

    const admin = getAdminClient();
    await admin.from('fx_rates_cache').insert([
      { rate_date: '2025-01-02', base: 'EUR', quote: 'BRL', rate: 6.0 },
      { rate_date: '2025-06-15', base: 'EUR', quote: 'BRL', rate: 6.3 },
      { rate_date: '2025-12-29', base: 'EUR', quote: 'BRL', rate: 6.5 },
    ]);

    const supabase = await getAuthedClient();
    const series = await getRateHistory({
      supabase,
      serviceSupabase: admin,
      base: 'EUR',
      quote: 'BRL',
      from: '2025-01-01',
      to: '2025-12-31',
    });

    expect(httpCalls).toBe(0);
    expect(series).toHaveLength(3);
  });

  it('I-FXH3 — fetch falha: retorna o que o cache tiver (graceful)', async () => {
    server.use(http.get(SERIES_URL, () => HttpResponse.error()));

    const admin = getAdminClient();
    await admin.from('fx_rates_cache').insert([
      { rate_date: '2025-06-15', base: 'EUR', quote: 'BRL', rate: 6.3 },
    ]);

    const supabase = await getAuthedClient();
    const series = await getRateHistory({
      supabase,
      serviceSupabase: admin,
      base: 'EUR',
      quote: 'BRL',
      from: '2025-01-01',
      to: '2025-12-31',
    });

    expect(series).toEqual([{ date: '2025-06-15', rate: 6.3 }]);
  });
});
