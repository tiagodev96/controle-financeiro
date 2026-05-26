import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsFixtureUser } from '../helpers/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const PROFILE = '00000000-0000-4000-8000-000000000001';
const ACCOUNT_EUR = '22222222-2222-4222-8222-222222222001';
const CATEGORY = '33333333-3333-4333-8333-333333333001';

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seedPending(description: string, daysAhead: number): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from('transactions').delete().eq('household_id', HOUSEHOLD);
  await admin.from('transactions').insert({
    household_id: HOUSEHOLD,
    profile_id: PROFILE,
    account_id: ACCOUNT_EUR,
    category_id: CATEGORY,
    direction: 'expense',
    amount_cents: 4500,
    currency: 'EUR',
    description,
    occurred_on: isoOffset(daysAhead),
    status: 'pending',
  });
}

async function cleanup(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from('transactions').delete().eq('household_id', HOUSEHOLD);
}

test.describe('Próximos 7 dias no dashboard', () => {
  test.afterEach(cleanup);

  test('E-NEXT7 — dashboard lista pending dentro dos próximos 7 dias', async ({ page, context }) => {
    const desc = `Aluguel 7d ${Date.now()}`;
    await seedPending(desc, 3);
    await signInAsFixtureUser(context);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /pr[óo]ximos 7 dias/i })).toBeVisible();
    await expect(page.getByText(desc).first()).toBeVisible();
  });
});
