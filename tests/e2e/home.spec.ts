import { test, expect } from '@playwright/test';

test('login page exibe o formulário de email', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByPlaceholder('voce@exemplo.com')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enviar link mágico' })
  ).toBeVisible();
});
