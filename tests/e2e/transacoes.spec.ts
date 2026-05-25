import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Transações', () => {
  test('E-T1 — /transacoes renderiza header e respeita auth', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/transacoes');

    await expect(page.getByRole('heading', { name: /transa[çc]ões/i })).toBeVisible();
    await expect(page).toHaveURL(/\/transacoes/);
  });

  test('E-T2 — filtro status=pendente atualiza URL e lista', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/transacoes');

    await page.getByLabel(/status/i).selectOption('pending');

    await expect(page).toHaveURL(/[?&]status=pending/);
  });

  test('E-T3 — click Check em pendente vira paid + toast', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    // Lança uma despesa pendente única pra esse teste pegar
    await page.goto('/lancar');
    await page.getByLabel(/valor/i).fill('99,99');
    await page.getByLabel(/descrição/i).fill('Marcar pago teste E-T3');
    await page.getByRole('button', { name: /mercado/i }).first().click();
    await page.getByRole('button', { name: /lançar despesa/i }).click();
    await expect(page.getByText(/despesa lançada/i).first()).toBeVisible();

    await page.goto('/transacoes?status=pending');

    await expect(page.getByText('Marcar pago teste E-T3').first()).toBeVisible();
    await page.getByRole('button', { name: /marcar como pago/i }).first().click();

    await expect(page.getByText(/marcada como pago/i)).toBeVisible();
  });
});
