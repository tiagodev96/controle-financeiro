import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Recorrentes', () => {
  test('E-RR — cria regra, gera mês, vê pending em /transacoes', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `RR aluguel ${Date.now()}`;

    await page.goto('/recorrentes');
    await expect(page.getByRole('heading', { name: /recorrentes/i })).toBeVisible();

    await page.getByRole('button', { name: /nova regra/i }).click();

    await page.getByPlaceholder(/ex: aluguel/i).fill(title);
    await page.getByLabel(/valor/i).fill('85000');
    await page.getByRole('button', { name: /criar regra/i }).click();

    await expect(page.getByText(title).first()).toBeVisible();

    await page.getByRole('button', { name: /gerar este mês/i }).click();

    // Toast pode mostrar "Geradas 1 transação" (se primeira execução do mês)
    // ou "Tudo já lançado" (se já gerou antes nessa session).
    await expect(
      page.getByText(/(geradas \d+ transaç|tudo já lançado)/i).first(),
    ).toBeVisible();

    // Vai pra /transacoes e procura a transação criada com o título
    await page.goto('/transacoes');
    await expect(page.getByText(title).first()).toBeVisible();
  });
});
