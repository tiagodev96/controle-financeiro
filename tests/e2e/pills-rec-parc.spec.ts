import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Pills REC / PARC em /transacoes', () => {
  test('E-PILL-REC — transaction gerada por regra mostra pill REC', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `RR pill ${Date.now()}`;

    await page.goto('/recorrentes');
    await page.getByRole('button', { name: /nova regra/i }).click();
    await page.getByPlaceholder(/ex: aluguel/i).fill(title);
    await page.getByLabel(/valor/i).fill('8500');
    await page.getByRole('button', { name: /criar regra/i }).click();
    await expect(page.getByText(title).first()).toBeVisible();

    await page.getByRole('button', { name: /gerar este mês/i }).click();
    await expect(
      page.getByText(/(geradas \d+ transaç|tudo já lançado)/i).first(),
    ).toBeVisible();

    await page.goto('/transacoes');
    const row = page.locator('[data-testid^="txn-row-"]').filter({ hasText: title }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText(/^REC$/)).toBeVisible();
  });

  test('E-PILL-PARC — transaction de parcelado mostra pill X/N', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `PARC pill ${Date.now()}`;

    await page.goto('/parcelados');
    await page.getByRole('button', { name: /novo parcelado/i }).click();
    await page.getByPlaceholder(/notebook|sof[áa]/i).first().fill(title);
    await page.getByLabel(/valor total/i).fill('40000');
    await page.getByLabel(/parcelas/i).fill('4');
    await page.getByRole('button', { name: /criar parcelado/i }).click();
    await expect(page.getByText(title).first()).toBeVisible();

    await page.goto('/transacoes');
    const row = page.locator('[data-testid^="txn-row-"]').filter({ hasText: title }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText(/^1\/4$/)).toBeVisible();
  });
});
