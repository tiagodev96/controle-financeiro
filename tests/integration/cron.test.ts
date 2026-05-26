import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { GET as recurringCronGet } from '@/app/api/cron/recurring/route';
import { GET as fxCronGet } from '@/app/api/cron/fx/route';
import { getAdminClient } from './helpers/db';
import {
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';

const FRANKFURTER_URL = 'https://api.frankfurter.app/latest';
const SECRET = process.env.CRON_SECRET ?? 'cron-test-secret';

const server = setupServer();

beforeAll(() => {
  process.env.CRON_SECRET = SECRET;
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterAll(() => server.close());

async function cleanupAll(): Promise<void> {
  const admin = getAdminClient();
  await admin.from('transactions').delete().eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
  await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'CRON test %');
  await admin.from('fx_rates_cache').delete().neq('rate_date', '1900-01-01');
}

beforeEach(async () => {
  server.resetHandlers();
  await cleanupAll();
});
afterEach(cleanupAll);

function authed(req: { headers?: Record<string, string> } = {}): Request {
  return new Request('http://localhost/api/cron/recurring', {
    headers: { authorization: `Bearer ${SECRET}`, ...req.headers },
  });
}

describe('cron endpoints (integração + MSW)', () => {
  it('I-CRON-AUTH1 — sem authorization retorna 401', async () => {
    const res = await recurringCronGet(new Request('http://localhost/api/cron/recurring'));
    expect(res.status).toBe(401);
  });

  it('I-CRON-AUTH2 — bearer com secret errado retorna 401', async () => {
    const res = await recurringCronGet(
      new Request('http://localhost/api/cron/recurring', {
        headers: { authorization: 'Bearer wrong' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('I-CRON-RR — gera transactions pending para regra ativa do mês', async () => {
    const admin = getAdminClient();
    const now = new Date();
    // active_from = início do mês corrente, pra isolar do sweep retroativo
    // (cron varre 3 meses, mas regra inativa nos anteriores é pulada).
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    await admin.from('recurring_rules').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      title: 'CRON test aluguel',
      amount_cents: 80000,
      direction: 'expense',
      category_id: SEED_CATEGORY_MERCADO_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      day_of_month: 5,
      currency: 'EUR',
      frequency: 'monthly',
      is_paused: false,
      active_from: currentMonthStart,
    });

    const res = await recurringCronGet(authed());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      summary: { householdId: string; created: number; skipped: number }[];
    };
    expect(body.ok).toBe(true);
    const myRun = body.summary.find((s) => s.householdId === SEED_DEMO_HOUSEHOLD_ID);
    expect(myRun?.created ?? 0).toBeGreaterThan(0);

    const { data: txns } = await admin
      .from('transactions')
      .select('description, status')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .like('description', 'CRON test aluguel%');
    expect(txns?.length ?? 0).toBe(1);
    expect(txns?.[0]?.status).toBe('pending');

    // Re-run idempotente: segunda chamada não cria nova transaction.
    const res2 = await recurringCronGet(authed());
    const body2 = (await res2.json()) as {
      summary: { householdId: string; created: number; skipped: number }[];
    };
    const myRun2 = body2.summary.find((s) => s.householdId === SEED_DEMO_HOUSEHOLD_ID);
    expect(myRun2?.created ?? 0).toBe(0);
  });

  it('I-CRON-RR-RETRO — sweep retroativo preenche gaps de meses anteriores', async () => {
    const admin = getAdminClient();
    const now = new Date();
    // Regra ativa há ≥3 meses → o sweep gera 3 transactions (cur + 2 atrás).
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 4, 1)
      .toISOString()
      .slice(0, 10);

    await admin.from('recurring_rules').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      title: 'CRON test retro',
      amount_cents: 4400,
      direction: 'expense',
      category_id: SEED_CATEGORY_MERCADO_ID,
      account_id: SEED_ACCOUNT_EUR_ID,
      day_of_month: 10,
      currency: 'EUR',
      frequency: 'monthly',
      is_paused: false,
      active_from: threeMonthsAgo,
    });

    const res = await recurringCronGet(authed());
    expect(res.status).toBe(200);

    const { data: txns } = await admin
      .from('transactions')
      .select('occurred_on')
      .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
      .like('description', 'CRON test retro%')
      .order('occurred_on', { ascending: true });
    expect(txns?.length ?? 0).toBe(3);
  });

  it('I-CRON-FX — insere rate de hoje em fx_rates_cache', async () => {
    server.use(
      http.get(FRANKFURTER_URL, () =>
        HttpResponse.json({ amount: 1, base: 'EUR', date: '2026-05-26', rates: { BRL: 6.12 } }),
      ),
    );

    const res = await fxCronGet(
      new Request('http://localhost/api/cron/fx', {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(200);

    const admin = getAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from('fx_rates_cache')
      .select('rate, rate_date, base, quote')
      .eq('rate_date', today)
      .single();
    expect(data?.rate).toBe(6.12);
    expect(data?.base).toBe('EUR');
    expect(data?.quote).toBe('BRL');
  });
});
