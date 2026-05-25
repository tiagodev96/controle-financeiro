import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

test.describe('Lançar despesa', () => {
  test('E1 — lança despesa pendente com sucesso (happy path)', async ({ page, context }) => {
    await loginAsTestUser(context);

    await page.goto('/lancar');

    await expect(page.getByRole('heading', { name: /lançar despesa/i })).toBeVisible();

    await page.getByLabel(/valor/i).fill('12,50');
    await page.getByLabel(/descrição/i).fill('Pão na padaria');
    await page.getByRole('button', { name: 'Mercado' }).click();

    await page.getByRole('button', { name: /^lançar despesa$/i }).click();

    await expect(page.getByText(/despesa lançada/i)).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('E2 — lança despesa marcada como "já pago" sem quebrar', async ({ page, context }) => {
    await loginAsTestUser(context);

    await page.goto('/lancar');

    await page.getByLabel(/valor/i).fill('45,00');
    await page.getByLabel(/descrição/i).fill('Almoço pago no PIX');
    await page.getByRole('button', { name: 'Restaurante' }).click();
    await page.getByLabel(/já pago/i).check();

    await page.getByRole('button', { name: /^lançar despesa$/i }).click();

    await expect(page.getByText(/despesa lançada/i)).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('E3 — household sem categorias mostra empty state com CTA', async ({ page, context }) => {
    await loginAsTestUser(context, { email: 'empty@example.com' });

    await page.goto('/lancar');

    await expect(page.getByRole('heading', { name: /lançar despesa/i })).toBeVisible();
    await expect(
      page.getByText(/crie ao menos uma categoria primeiro/i),
    ).toBeVisible();

    const cta = page.getByRole('link', { name: /criar categoria/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/categorias');

    await expect(page.getByRole('button', { name: /^lançar despesa$/i })).toHaveCount(0);
  });

  test('E4 — valor zero é rejeitado com mensagem inline e mantém o form', async ({ page, context }) => {
    await loginAsTestUser(context);

    await page.goto('/lancar');

    await page.getByLabel(/descrição/i).fill('Tentativa inválida');
    await page.getByRole('button', { name: 'Mercado' }).click();

    await page.getByRole('button', { name: /^lançar despesa$/i }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: /(inv[áa]lid|valor)/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/lancar$/);
    await expect(page.getByLabel(/descrição/i)).toHaveValue('Tentativa inválida');
  });
});
