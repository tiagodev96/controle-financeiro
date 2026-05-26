import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Resumo do mês', () => {
  test('E-RES1 — /resumo renderiza card, Copy escreve texto no clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInAsFixtureUser(context);

    await page.goto('/resumo');
    await expect(page.getByRole('heading', { name: /resumo do mês/i })).toBeVisible();
    await expect(page.getByText(/saldo previsto fim do mês/i).first()).toBeVisible();

    await page.getByRole('button', { name: /copiar texto/i }).click();

    await expect(page.getByText(/resumo copiado/i).first()).toBeVisible();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/^Resumo de \w+ · 20\d{2}/);
    expect(clip).toContain('Saldo previsto fim do mês:');
  });
});
