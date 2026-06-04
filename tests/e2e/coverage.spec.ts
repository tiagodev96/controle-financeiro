import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';
import { getAdminClient } from '../integration/helpers/db';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_EUR = '22222222-2222-4222-8222-222222222001';
const ACCOUNT_BRL = '22222222-2222-4222-8222-222222222002';
const TODAY = new Date().toISOString().slice(0, 10);
const APP_HOST = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000').hostname;

async function resetState(eurCents: number, brlCents: number): Promise<void> {
  const admin = getAdminClient();
  await admin.from('transactions').delete().eq('household_id', HOUSEHOLD);
  await admin.from('account_transfers').delete().eq('household_id', HOUSEHOLD);
  await admin.from('accounts').update({ balance_cents: eurCents }).eq('id', ACCOUNT_EUR);
  await admin.from('accounts').update({ balance_cents: brlCents }).eq('id', ACCOUNT_BRL);
  await admin
    .from('fx_rates_cache')
    .upsert(
      { rate_date: TODAY, base: 'EUR', quote: 'BRL', rate: 6 },
      { onConflict: 'rate_date,base,quote' },
    );
}

test.describe('Cobertura automática de pagamento', () => {
  test.afterEach(async () => {
    await resetState(0, 0);
  });

  test('E-COV1 — €100/R$0, paga R$12: abate €2 e mostra a conversão', async ({ page, context }) => {
    await resetState(10_000, 0);
    await signInAsFixtureUser(context);
    // Faz o form de lançamento abrir já na conta BRL (sem dirigir o select).
    await context.addCookies([
      { name: 'cf_last_account_id', value: ACCOUNT_BRL, domain: APP_HOST, path: '/' },
    ]);

    await page.goto('/lancar');
    await page.getByLabel(/valor/i).fill('12,00');
    await page.getByLabel(/descrição/i).fill('Conta de luz');
    await page.getByRole('button', { name: 'Mercado' }).click();
    await page.getByRole('button', { name: /já pago/i }).click();

    await page.getByRole('button', { name: /lançar despesa/i }).click();

    await expect(page).toHaveURL('/transacoes');

    // Linha de conversão visível com os valores: € 2,00 → R$ 12,00
    const conversion = page.getByText('Conversão').first();
    await expect(conversion).toBeVisible();
    const conversionRow = page.locator('[data-testid^="transfer-row-"]').first();
    await expect(conversionRow).toContainText('2,00');
    await expect(conversionRow).toContainText('12,00');

    // Saldos: BRL zerada, EUR em 98,00.
    await page.goto('/contas');
    await expect(page.getByText(/98,00/).first()).toBeVisible();
  });
});
