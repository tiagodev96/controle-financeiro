import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

const NEW_CAT = `Streaming ${Date.now()}`;
const NEW_ACC = `Itaú novo ${Date.now()}`;

test.describe('CRUD categorias e contas', () => {
  test('E-CAT1 — cria nova categoria de despesa', async ({ page, context }) => {
    await signInAsFixtureUser(context);
    await page.goto('/categorias');

    await page.getByRole('button', { name: /nova categoria/i }).click();
    await page.getByPlaceholder(/streaming/i).fill(NEW_CAT);
    await page.getByRole('button', { name: /criar categoria/i }).click();

    await expect(page.getByRole('button', { name: NEW_CAT, exact: true })).toBeVisible();
  });

  test('E-CAT2 — arquiva categoria → some das ativas e do /lancar', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    // Cria categoria isolada pra esse teste, evita race em arquivar uma do seed.
    const tempName = `Arquivar test ${Date.now()}`;
    await page.goto('/categorias');
    await page.getByRole('button', { name: /nova categoria/i }).click();
    await page.getByPlaceholder(/streaming/i).fill(tempName);
    await page.getByRole('button', { name: /criar categoria/i }).click();
    await expect(page.getByRole('button', { name: tempName, exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Ações para ${tempName}` }).click();
    await page.getByRole('button', { name: /^arquivar$/i }).click();

    await expect(page.getByText(/arquivadas/i)).toBeVisible();

    await page.goto('/lancar');
    await expect(page.getByRole('button', { name: tempName, exact: true })).toHaveCount(0);
  });

  test('E-ACC1 — cria nova conta com saldo inicial', async ({ page, context }) => {
    await signInAsFixtureUser(context);
    await page.goto('/contas');

    await page.getByRole('button', { name: /nova conta/i }).click();
    await page.getByPlaceholder(/ita[úu] corrente/i).fill(NEW_ACC);
    await page.getByLabel(/saldo inicial/i).fill('1500,00');
    await page.getByRole('button', { name: /criar conta/i }).click();

    await expect(page.getByRole('button', { name: NEW_ACC, exact: true })).toBeVisible();
  });
});
