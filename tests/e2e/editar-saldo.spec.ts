import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Editar saldo manual em /contas', () => {
  test('E-BAL — abre menu, dialog, salva novo saldo e persiste após reload', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const accName = `Itaú saldo ${Date.now()}`;

    await page.goto('/contas');
    await page.getByRole('button', { name: /nova conta/i }).click();
    await page.getByPlaceholder(/ita[úu] corrente/i).fill(accName);
    await page.getByLabel(/saldo inicial/i).fill('100');
    await page.getByRole('button', { name: /criar conta/i }).click();
    await expect(page.getByRole('button', { name: accName, exact: true })).toBeVisible();

    await page.getByRole('button', { name: `Ações para ${accName}` }).click();
    await page.getByRole('button', { name: /editar saldo/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/saldo em/i).fill('250000');
    await dialog.getByRole('button', { name: /salvar saldo/i }).click();

    await expect(page.getByText(/saldo atualizado/i).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('2.500,00').first()).toBeVisible();
  });
});
