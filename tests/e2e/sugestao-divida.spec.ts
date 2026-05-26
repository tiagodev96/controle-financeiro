import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsFixtureUser } from '../helpers/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEED_HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const SEED_ACCOUNT_EUR_ID = '22222222-2222-4222-8222-222222222001';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function seed(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await admin
    .from('accounts')
    .update({ balance_cents: 500_00 })
    .eq('id', SEED_ACCOUNT_EUR_ID);

  // Pending income este mês pra empurrar sobra prevista pra positivo.
  await admin.from('transactions').delete().eq('household_id', SEED_HOUSEHOLD_ID);

  await admin.from('transactions').insert({
    household_id: SEED_HOUSEHOLD_ID,
    profile_id: '00000000-0000-4000-8000-000000000001',
    account_id: SEED_ACCOUNT_EUR_ID,
    direction: 'income',
    amount_cents: 300_00,
    currency: 'EUR',
    description: 'Salário pendente',
    occurred_on: todayIso(),
    status: 'pending',
  });

  await admin
    .from('debts')
    .delete()
    .eq('household_id', SEED_HOUSEHOLD_ID)
    .like('title', 'SUG test %');

  await admin.from('debts').insert({
    household_id: SEED_HOUSEHOLD_ID,
    title: 'SUG test Jefferson',
    original_amount_cents: 1000_00,
    remaining_amount_cents: 1000_00,
    currency: 'EUR',
    priority: 1,
    status: 'open',
  });
}

async function cleanup(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from('transactions').delete().eq('household_id', SEED_HOUSEHOLD_ID);
  await admin
    .from('debts')
    .delete()
    .eq('household_id', SEED_HOUSEHOLD_ID)
    .like('title', 'SUG test %');
}

test.describe('Sugestão de dívida no dashboard', () => {
  test.afterEach(cleanup);

  test('E-SUG1 — card aparece e botão abre dialog com valor sugerido', async ({ page, context }) => {
    await seed();
    await signInAsFixtureUser(context);

    await page.goto('/');
    await expect(page.getByText(/sugest[aã]o/i).first()).toBeVisible();
    await expect(page.getByText(/SUG test Jefferson/i).first()).toBeVisible();

    await page.getByRole('button', { name: /registrar pagamento/i }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/SUG test Jefferson/i).first()).toBeVisible();
  });
});
