import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsFixtureUser } from '../helpers/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEED_ACCOUNT_EUR_ID = '22222222-2222-4222-8222-222222222001';
const SEED_ACCOUNT_BRL_ID = '22222222-2222-4222-8222-222222222002';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function seedFxAndBalances(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Isola: arquiva qualquer conta extra que outros E2E tenham criado.
  await admin
    .from('accounts')
    .update({ is_archived: true })
    .eq('household_id', '11111111-1111-4111-8111-111111111111')
    .not('id', 'in', `(${SEED_ACCOUNT_EUR_ID},${SEED_ACCOUNT_BRL_ID})`);

  await admin
    .from('accounts')
    .update({ balance_cents: 200000, is_archived: false })
    .eq('id', SEED_ACCOUNT_EUR_ID);
  await admin
    .from('accounts')
    .update({ balance_cents: 600000, is_archived: false })
    .eq('id', SEED_ACCOUNT_BRL_ID);

  await admin
    .from('fx_rates_cache')
    .upsert(
      {
        rate_date: todayIso(),
        base: 'EUR',
        quote: 'BRL',
        rate: 6.0,
      },
      { onConflict: 'rate_date,base,quote' },
    );
}

async function resetUserPreference(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin
    .from('profiles')
    .update({ preferred_display_currency: 'EUR' })
    .eq('id', '00000000-0000-4000-8000-000000000001');
}

test.describe('Câmbio', () => {
  test.afterEach(resetUserPreference);

  test('E-FX1 — dashboard mostra total convertido em EUR e cotação no chip', async ({ page, context }) => {
    await seedFxAndBalances();
    await signInAsFixtureUser(context);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Dashboard nasce com valores ocultos — revela antes de conferir.
    await page.getByRole('button', { name: /mostrar valores/i }).click();

    await expect(page.getByText(/saldo total/i).first()).toBeVisible();
    // Total convertido EUR = € 2.000 + (R$ 6.000 / 6) = € 3.000
    await expect(page.getByText('3.000', { exact: false }).first()).toBeVisible();

    await expect(page.getByText(/1\s*€\s*=\s*R\$\s*6,00/i).first()).toBeVisible();
  });

  test('E-FX-TOGGLE — clicar no toggle troca pra BRL e persiste após reload', async ({ page, context }) => {
    await seedFxAndBalances();
    await signInAsFixtureUser(context);

    await page.goto('/');
    await expect(page.getByRole('button', { name: /trocar moeda principal/i }).first()).toBeVisible();

    // Dashboard nasce com valores ocultos — revela antes de conferir.
    await page.getByRole('button', { name: /mostrar valores/i }).click();
    await page.getByRole('button', { name: /trocar moeda principal/i }).first().click();

    // Total convertido BRL = R$ 6.000 + (€ 2.000 * 6) = R$ 18.000
    await expect(page.getByText('18.000', { exact: false }).first()).toBeVisible();

    await page.reload();
    // Visibilidade é estado client de sessão — reload volta mascarado.
    await page.getByRole('button', { name: /mostrar valores/i }).click();
    await expect(page.getByText('18.000', { exact: false }).first()).toBeVisible();
  });
});
