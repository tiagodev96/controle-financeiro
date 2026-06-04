import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  recordConversionCore,
  deleteConversionCore,
} from '@/server/actions/conversions/core';
import { getAuthedClient, SEED_SESSION, SEED_DEMO_HOUSEHOLD_ID } from './helpers/auth';
import { getAdminClient } from './helpers/db';

const SERIES_URL = 'https://api.frankfurter.dev/v1/:range';
const server = setupServer();

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await admin.from('currency_conversions').delete().eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
  await admin.from('fx_rates_cache').delete().neq('rate_date', '1900-01-01');
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(async () => {
  server.resetHandlers();
  await cleanup();
});
afterEach(cleanup);

function serviceDeps(supabase: Awaited<ReturnType<typeof getAuthedClient>>) {
  return { supabase, session: SEED_SESSION, serviceSupabase: getAdminClient() };
}

describe('conversions CRUD (integração)', () => {
  it('I-CONV1 — registra com effective_rate calculado e mid_market_rate do cache', async () => {
    const admin = getAdminClient();
    await admin.from('fx_rates_cache').insert({
      rate_date: '2025-05-10',
      base: 'EUR',
      quote: 'BRL',
      rate: 6.0,
    });

    const supabase = await getAuthedClient();
    const result = await recordConversionCore(serviceDeps(supabase), {
      fromCurrency: 'EUR',
      toCurrency: 'BRL',
      fromAmountCents: 100_000,
      toAmountCents: 595_000,
      convertedOn: '2025-05-10',
      note: 'Wise',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number(result.conversion.effective_rate)).toBeCloseTo(5.95, 6);
    expect(Number(result.conversion.mid_market_rate)).toBeCloseTo(6.0, 6);
    expect(result.conversion.household_id).toBe(SEED_DEMO_HOUSEHOLD_ID);
  });

  it('I-CONV2 — mid indisponível: insere com mid_market_rate null', async () => {
    server.use(http.get(SERIES_URL, () => HttpResponse.error()));

    const supabase = await getAuthedClient();
    const result = await recordConversionCore(serviceDeps(supabase), {
      fromCurrency: 'BRL',
      toCurrency: 'EUR',
      fromAmountCents: 600_000,
      toAmountCents: 98_000,
      convertedOn: '2025-05-11',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.conversion.mid_market_rate).toBeNull();
    expect(Number(result.conversion.effective_rate)).toBeCloseTo(98_000 / 600_000, 6);
  });

  it('I-CONV3 — moedas iguais → ok:false', async () => {
    const supabase = await getAuthedClient();
    const result = await recordConversionCore(serviceDeps(supabase), {
      fromCurrency: 'EUR',
      toCurrency: 'EUR',
      fromAmountCents: 100_000,
      toAmountCents: 100_000,
      convertedOn: '2025-05-10',
    });
    expect(result.ok).toBe(false);
  });

  it('I-CONV4 — valores não positivos → ok:false', async () => {
    const supabase = await getAuthedClient();
    const result = await recordConversionCore(serviceDeps(supabase), {
      fromCurrency: 'EUR',
      toCurrency: 'BRL',
      fromAmountCents: 0,
      toAmountCents: 595_000,
      convertedOn: '2025-05-10',
    });
    expect(result.ok).toBe(false);
  });

  it('I-CONV5 — deleteConversionCore remove a própria conversão', async () => {
    server.use(http.get(SERIES_URL, () => HttpResponse.error()));
    const supabase = await getAuthedClient();
    const created = await recordConversionCore(serviceDeps(supabase), {
      fromCurrency: 'EUR',
      toCurrency: 'BRL',
      fromAmountCents: 100_000,
      toAmountCents: 595_000,
      convertedOn: '2025-05-10',
    });
    if (!created.ok) throw new Error('setup');

    const result = await deleteConversionCore(
      { supabase, session: SEED_SESSION },
      { conversionId: created.conversion.id },
    );
    expect(result.ok).toBe(true);

    const admin = getAdminClient();
    const { data } = await admin
      .from('currency_conversions')
      .select('id')
      .eq('id', created.conversion.id)
      .maybeSingle();
    expect(data).toBeNull();
  });

  it('I-CONV6 — não deleta conversão de outro household', async () => {
    const OTHER_HOUSEHOLD = '44444444-4444-4444-8444-444444444444';
    const OTHER_PROFILE = '00000000-0000-4000-8000-000000000002';
    const admin = getAdminClient();
    const { data: other } = await admin
      .from('currency_conversions')
      .insert({
        household_id: OTHER_HOUSEHOLD,
        profile_id: OTHER_PROFILE,
        from_currency: 'EUR',
        to_currency: 'BRL',
        from_amount_cents: 100_000,
        to_amount_cents: 595_000,
        effective_rate: 5.95,
        converted_on: '2025-05-10',
      })
      .select('id')
      .single();

    try {
      const supabase = await getAuthedClient();
      const result = await deleteConversionCore(
        { supabase, session: SEED_SESSION },
        { conversionId: other!.id },
      );
      expect(result.ok).toBe(false);

      const { data: still } = await admin
        .from('currency_conversions')
        .select('id')
        .eq('id', other!.id)
        .maybeSingle();
      expect(still?.id).toBe(other!.id);
    } finally {
      await admin.from('currency_conversions').delete().eq('id', other!.id);
    }
  });
});
