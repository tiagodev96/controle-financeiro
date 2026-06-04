import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsFixtureUser } from '../helpers/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function seedHistory(): Promise<void> {
  const db = admin();
  // Cobre o intervalo de 1 ano (bordas dentro da tolerância) pra que o chart
  // renderize sem fetch externo ao frankfurter.
  await db.from('fx_rates_cache').upsert(
    [
      { rate_date: isoDaysAgo(364), base: 'EUR', quote: 'BRL', rate: 5.5 },
      { rate_date: isoDaysAgo(30), base: 'EUR', quote: 'BRL', rate: 5.8 },
      { rate_date: isoDaysAgo(0), base: 'EUR', quote: 'BRL', rate: 6.0 },
    ],
    { onConflict: 'rate_date,base,quote' },
  );
}

async function clearConversions(): Promise<void> {
  await admin().from('currency_conversions').delete().eq('household_id', HOUSEHOLD_ID);
}

test.describe('Câmbio histórico + conversões', () => {
  test.beforeEach(async () => {
    await seedHistory();
    await clearConversions();
  });
  test.afterEach(clearConversions);

  test('E-CONV1 — gráfico do euro no rodapé com seletor de período', async ({ page, context }) => {
    await signInAsFixtureUser(context);
    await page.goto('/');

    await expect(page.getByText('Valor do euro')).toBeVisible();
    await page.getByRole('button', { name: '7 dias' }).click();
    await expect(page.getByRole('button', { name: '7 dias' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('E-CONV2 — registrar conversão aparece na lista e liga o spread', async ({ page, context }) => {
    await signInAsFixtureUser(context);
    await page.goto('/');

    await expect(page.getByText(/Registre uma conversão pra eu estimar/i)).toBeVisible();

    await page.getByRole('button', { name: 'Registrar' }).click();
    await page.getByLabel('Enviado (€)').fill('100000');
    await page.getByLabel('Recebido (R$)').fill('595000');
    await page.getByRole('button', { name: 'Registrar conversão' }).click();

    await expect(page.getByText('Euro → Real').first()).toBeVisible();
    await expect(page.getByText(/spread médio/i)).toBeVisible();
  });
});
