import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe.configure({ mode: 'serial' });

test.describe('Parcelados', () => {
  test('E-PARC1 — cria plano de 4× R$ 100, gera 4 pending em /transacoes', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `Notebook ${Date.now()}`;

    await page.goto('/parcelados');
    await expect(page.getByRole('heading', { name: /parcelados/i })).toBeVisible();

    await page.getByRole('button', { name: /novo parcelado/i }).click();

    await page.getByPlaceholder(/notebook|sof[áa]/i).first().fill(title);
    await page.getByLabel(/valor total/i).fill('40000');
    await page.getByLabel(/parcelas/i).fill('4');
    await page.getByRole('button', { name: /criar parcelado/i }).click();

    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText(/4×/i).first()).toBeVisible();

    // /transacoes filtra por mês corrente por padrão; só a 1ª parcela cai
    // dentro do mês de hoje. As outras 3 são validadas no integration test
    // I-PARC-CRUD1 que verifica direto no DB.
    await page.goto('/transacoes');
    await expect(page.getByText(`${title} 1/4`, { exact: false }).first()).toBeVisible();
  });

  test('E-PARC-EDIT — edita título e notas do plano, novo título aparece no card', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const original = `Sofá ${Date.now()}`;
    const renamed = `Sofá renomeado ${Date.now()}`;

    await page.goto('/parcelados');
    await page.getByRole('button', { name: /novo parcelado/i }).click();
    await page.getByPlaceholder(/notebook|sof[áa]/i).first().fill(original);
    await page.getByLabel(/valor total/i).fill('30000');
    await page.getByLabel(/parcelas/i).fill('3');
    await page.getByRole('button', { name: /criar parcelado/i }).click();
    await expect(page.getByText(original).first()).toBeVisible();

    await page.getByRole('button', { name: `Ações para ${original}` }).click();
    await page.getByRole('button', { name: /^editar$/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const titleInput = dialog.getByLabel(/título/i);
    await titleInput.fill(renamed);
    await dialog.getByRole('button', { name: /salvar altera/i }).click();

    await expect(page.getByText(/parcelado atualizado/i).first()).toBeVisible();
    await expect(page.getByText(renamed).first()).toBeVisible();
  });
});
