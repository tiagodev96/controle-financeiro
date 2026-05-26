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

    await page.getByLabel('Status').click();
    await page.getByRole('option', { name: /pendente/i }).click();

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
    await page.getByRole('button', { name: /só marcar como paga/i }).click();

    await expect(page.getByText(/marcada como paga/i).first()).toBeVisible();
  });

  test('E-ED1 — edita valor de transação via dialog', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const desc = `Editar valor teste ${Date.now()}`;
    // Lança transação pra editar
    await page.goto('/lancar');
    await page.getByLabel(/valor/i).fill('1234');
    await page.getByLabel(/descrição/i).fill(desc);
    await page.getByRole('button', { name: /mercado/i }).first().click();
    await page.getByRole('button', { name: /lançar despesa/i }).click();
    await expect(page.getByText(/despesa lançada/i).first()).toBeVisible();

    await page.goto('/transacoes');
    const row = page
      .locator('[data-testid^="txn-row-"]')
      .filter({ has: page.getByText(desc, { exact: true }) })
      .first();
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: /mais ações/i }).click();
    await page.getByRole('button', { name: /^editar$/i }).click();

    // Apaga o valor antigo e digita novo
    const valorInput = page.getByLabel('Valor');
    await valorInput.fill('');
    await valorInput.fill('5000');

    await page.getByRole('button', { name: /salvar alterações/i }).click();

    await expect(page.getByText(/lançamento atualizado/i).first()).toBeVisible();
    await expect(page.getByText(/€\s*50,00/).first()).toBeVisible();
  });

  test('E-ED2 — edita conta de EUR pra BRL e currency segue', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const desc = `Trocar conta teste ${Date.now()}`;
    await page.goto('/lancar');
    await page.getByLabel(/valor/i).fill('500');
    await page.getByLabel(/descrição/i).fill(desc);
    await page.getByRole('button', { name: /mercado/i }).first().click();
    await page.getByRole('button', { name: /lançar despesa/i }).click();
    await expect(page.getByText(/despesa lançada/i).first()).toBeVisible();

    await page.goto('/transacoes');
    const row = page
      .locator('[data-testid^="txn-row-"]')
      .filter({ has: page.getByText(desc, { exact: true }) })
      .first();
    await row.getByRole('button', { name: /mais ações/i }).click();
    await page.getByRole('button', { name: /^editar$/i }).click();

    const dialog = page.getByRole('dialog', { name: /editar lançamento/i });
    await dialog.getByLabel('Conta').click();
    await page.getByRole('option', { name: 'Conta principal BRL' }).click();
    await page.getByRole('button', { name: /salvar alterações/i }).click();

    await expect(page.getByText(/lançamento atualizado/i).first()).toBeVisible();
    await page.reload();
    const updatedRow = page
      .locator('[data-testid^="txn-row-"]')
      .filter({ has: page.getByText(desc, { exact: true }) })
      .first();
    await expect(updatedRow.getByText(/R\$/)).toBeVisible();
  });

  test('E-ED3 — cancela (deleta) transação', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const desc = `Deletar teste ${Date.now()}`;
    await page.goto('/lancar');
    await page.getByLabel(/valor/i).fill('999');
    await page.getByLabel(/descrição/i).fill(desc);
    await page.getByRole('button', { name: /mercado/i }).first().click();
    await page.getByRole('button', { name: /lançar despesa/i }).click();
    await expect(page.getByText(/despesa lançada/i).first()).toBeVisible();

    await page.goto('/transacoes');
    const row = page
      .locator('[data-testid^="txn-row-"]')
      .filter({ has: page.getByText(desc, { exact: true }) })
      .first();
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: /mais ações/i }).click();
    await page.getByRole('button', { name: /cancelar lançamento/i }).click();

    await expect(page.getByText(/lançamento removido/i).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText(desc)).toHaveCount(0);
  });
});
