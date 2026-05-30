import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsFixtureUser } from '../helpers/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEED_HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const SEED_CATEGORY_MERCADO_ID = '33333333-3333-4333-8333-333333333001';

async function cleanup(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin
    .from('categories')
    .update({ is_essential: false })
    .eq('id', SEED_CATEGORY_MERCADO_ID);
  await admin
    .from('envelopes')
    .delete()
    .eq('household_id', SEED_HOUSEHOLD_ID)
    .like('name', 'E2E reserva%');
  await admin
    .from('envelopes')
    .delete()
    .eq('household_id', SEED_HOUSEHOLD_ID)
    .in('name', ['Reserva (R$)', 'Reserva (€)']);
}

test.describe.configure({ mode: 'serial' });

test.describe('Aba Reserva', () => {
  test.afterEach(cleanup);

  test('E-RES1 — marca categoria essencial e persiste após reload', async ({ page, context }) => {
    await cleanup();
    await signInAsFixtureUser(context);

    await page.goto('/reserva');
    await expect(page.getByRole('heading', { name: 'Reserva', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Categorias essenciais' })).toBeVisible();

    const mercado = page.getByRole('button', { name: 'Mercado' });
    await expect(mercado).toHaveAttribute('aria-pressed', 'false');
    await mercado.click();
    await expect(mercado).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Mercado' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('E-RES2 — reserva tem subcontas fixas por moeda, sem picker', async ({ page, context }) => {
    await signInAsFixtureUser(context);
    await page.goto('/reserva');

    await expect(page.getByRole('heading', { name: 'Caixinha de reserva' })).toBeVisible();
    await expect(page.getByText('Reserva guardada')).toBeVisible();
    await expect(page.getByText(/caixinha de reserva definida/i)).toHaveCount(0);

    await page.goto('/caixinhas');
    await expect(page.getByText('Reserva (€)')).toBeVisible();
    await expect(page.getByText('Reserva (R$)')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ações para Reserva (€)' }),
    ).toHaveCount(0);
  });

  test('E-RES3 — aloca saldo na subconta € direto na página Reserva', async ({ page, context }) => {
    await signInAsFixtureUser(context);
    await page.goto('/reserva');

    await page.getByRole('button', { name: 'Alocar em Reserva (€)' }).click();
    await page.getByLabel('Valor').fill('5000');
    await page.getByRole('button', { name: 'Alocar', exact: true }).click();

    await expect(page.getByText('€ 50,00').first()).toBeVisible();
  });
});
