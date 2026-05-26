import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsFixtureUser } from '../helpers/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEED_HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const SEED_ACCOUNT_EUR_ID = '22222222-2222-4222-8222-222222222001';
const INITIAL = 100_000;

async function resetState(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Apaga só as transactions deste spec — outros specs em paralelo dependem
  // das suas próprias transactions.
  await admin
    .from('transactions')
    .delete()
    .eq('household_id', SEED_HOUSEHOLD_ID)
    .or('description.ilike.%sem mexer no saldo%,description.ilike.%com saldo on%');
  await admin
    .from('accounts')
    .update({ balance_cents: INITIAL })
    .eq('id', SEED_ACCOUNT_EUR_ID);
}

async function readBalance(): Promise<number> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin
    .from('accounts')
    .select('balance_cents')
    .eq('id', SEED_ACCOUNT_EUR_ID)
    .single();
  return data?.balance_cents ?? 0;
}

test.describe.configure({ mode: 'serial' });

test.describe('Toggle atualizar saldo', () => {
  test.beforeEach(resetState);
  test.afterEach(resetState);

  test('E-BAL-LANCAR-OFF — criar despesa paga com toggle de saldo OFF preserva saldo', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar');
    await page.getByLabel(/valor/i).fill('2000');
    await page.getByLabel(/descrição/i).fill('Despesa sem mexer no saldo');
    await page.getByRole('button', { name: /mercado/i }).first().click();

    // Liga "já pago" (default OFF pra despesa)
    await page.getByRole('button', { name: /já pago/i }).click();
    // Desliga "atualizar saldo" (default ON quando paid)
    await page.getByRole('button', { name: /atualizar saldo da conta/i }).click();

    await page.getByRole('button', { name: /lançar despesa/i }).click();
    await expect(page.getByText(/despesa lançada/i).first()).toBeVisible();

    expect(await readBalance()).toBe(INITIAL);
  });

  test('E-BAL-LANCAR-ON — criar entrada já recebida com toggle ON soma no saldo', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar?direction=income');
    await page.getByLabel(/valor/i).fill('5000');
    await page.getByLabel(/descrição/i).fill('Entrada com saldo on');
    await page.getByRole('button', { name: /salário/i }).first().click();

    // Entrada já vem com "já recebido" ON e "atualizar saldo" ON (default).
    await page.getByRole('button', { name: /lançar entrada/i }).click();
    await expect(page.getByText(/entrada lançada/i).first()).toBeVisible();

    expect(await readBalance()).toBe(INITIAL + 5000);
  });
});
