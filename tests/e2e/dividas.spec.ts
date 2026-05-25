import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Dívidas', () => {
  test('E-DB — cria dívida, registra pagamento parcial e depois quita', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `Jefferson ${Date.now()}`;

    await page.goto('/dividas');
    await expect(page.getByRole('heading', { name: /dívidas/i })).toBeVisible();

    // Cria dívida de €30,00 (3000 cents).
    await page.getByRole('button', { name: /nova dívida/i }).click();
    await page.getByPlaceholder(/empréstimo jefferson/i).fill(title);
    await page.getByLabel(/valor original/i).fill('3000');
    await page.getByRole('button', { name: /criar dívida/i }).click();

    const debtCard = page.locator(`[data-testid^="debt-row-"]`, { hasText: title });
    await expect(debtCard).toBeVisible();
    await expect(debtCard.getByText('€ 30,00').first()).toBeVisible();

    // Registra pagamento parcial €10,00 (1000 cents).
    await debtCard.getByRole('button', { name: /registrar pagamento/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/valor/i).fill('1000');
    await dialog.getByRole('button', { name: /registrar pagamento/i }).click();

    await expect(page.getByText(/pagamento registrado/i).first()).toBeVisible();

    // Restante deve cair pra €20,00 e progresso pra 33% (10/30).
    await expect(debtCard.getByText('€ 20,00').first()).toBeVisible();
    await expect(debtCard.getByText(/33% pago/i)).toBeVisible();

    // Registra o pagamento final €20,00.
    await debtCard.getByRole('button', { name: /registrar pagamento/i }).click();
    const dialog2 = page.getByRole('dialog');
    await dialog2.getByLabel(/valor/i).fill('2000');
    await dialog2.getByRole('button', { name: /registrar pagamento/i }).click();

    await expect(page.getByText(/dívida quitada/i).first()).toBeVisible();

    // Card desce pra Fechadas; recarrega só pra confirmar persistência.
    await page.reload();
    await expect(page.getByText(/fechadas/i).first()).toBeVisible();
    await expect(page.locator(`[data-testid^="debt-row-"]`, { hasText: title })).toBeVisible();
  });
});
