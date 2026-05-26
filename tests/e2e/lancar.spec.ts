import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Lançar despesa', () => {
  test('E1 — lança despesa pendente com sucesso (happy path)', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar');

    await expect(page.getByRole('heading', { name: /lançar despesa/i })).toBeVisible();

    await page.getByLabel(/valor/i).fill('12,50');
    await page.getByLabel(/descrição/i).fill('Pão na padaria');
    await page.getByRole('button', { name: 'Mercado' }).click();

    await page.getByRole('button', { name: /lançar despesa/i }).click();

    await expect(page).toHaveURL('/transacoes');
    await expect(page.getByText(/despesa lançada/i).first()).toBeVisible();
  });

  test('E2 — lança despesa marcada como "já pago" sem quebrar', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar');

    await page.getByLabel(/valor/i).fill('45,00');
    await page.getByLabel(/descrição/i).fill('Almoço pago no PIX');
    await page.getByRole('button', { name: 'Restaurante' }).click();
    await page.getByRole('button', { name: /já pago/i }).click();
    // Desliga "Atualizar saldo" pra não bagunçar outros specs que dependem do saldo da conta.
    await page.getByRole('button', { name: /atualizar saldo da conta/i }).click();

    await page.getByRole('button', { name: /lançar despesa/i }).click();

    await expect(page).toHaveURL('/transacoes');
    await expect(page.getByText(/despesa lançada/i).first()).toBeVisible();
  });

  test('E3 — household sem categorias mostra empty state com CTA', async ({ page, context }) => {
    await signInAsFixtureUser(context, { email: 'empty@example.com' });

    await page.goto('/lancar');

    await expect(page.getByRole('heading', { name: /lançar despesa/i })).toBeVisible();
    await expect(
      page.getByText(/crie ao menos uma categoria primeiro/i),
    ).toBeVisible();

    const cta = page.getByRole('link', { name: /criar categoria/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/categorias');

    await expect(page.getByRole('button', { name: /lançar despesa/i })).toHaveCount(0);
  });

  test('E-IN1 — lança entrada (income) feliz: toggle, categoria Salário, valor, toast', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar?direction=income');

    await expect(page.getByRole('heading', { name: /lançar entrada/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /entrada/i, selected: true })).toBeVisible();

    await page.getByLabel(/valor/i).fill('2.500,00');
    await page.getByLabel(/descrição/i).fill('Salário maio');
    await page.getByRole('button', { name: 'Salário' }).click();
    // Entrada vem com "já recebido" ON; desliga "Atualizar saldo" pra isolar.
    await page.getByRole('button', { name: /atualizar saldo da conta/i }).click();

    await page.getByRole('button', { name: /lançar entrada/i }).click();

    await expect(page).toHaveURL('/transacoes', { timeout: 10_000 });
    await expect(page.getByText(/entrada lançada/i).first()).toBeVisible();
  });

  test('E-IN2 — toggle Entrada navega via searchParam e troca categorias', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar');
    await expect(page.getByRole('button', { name: 'Mercado' })).toBeVisible();

    await page.getByRole('tab', { name: /entrada/i }).click();

    await expect(page).toHaveURL(/direction=income/);
    await expect(page.getByRole('button', { name: 'Salário' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mercado' })).toHaveCount(0);
  });

  test('E4 — valor zero é rejeitado com mensagem inline e mantém o form', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar');

    await page.getByLabel(/descrição/i).fill('Tentativa inválida');
    await page.getByRole('button', { name: 'Mercado' }).click();

    await page.getByRole('button', { name: /lançar despesa/i }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: /(inv[áa]lid|valor)/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/lancar$/);
    await expect(page.getByLabel(/descrição/i)).toHaveValue('Tentativa inválida');
  });

  test('E-LANCAR-CAT-INLINE — cria categoria inline durante o lançamento sem perder o form', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const newCat = `Inline ${Date.now()}`;

    await page.goto('/lancar');
    await page.getByLabel(/valor/i).fill('33,00');
    await page.getByLabel(/descrição/i).fill('Compra com categoria nova');

    await page.getByRole('button', { name: /criar nova categoria/i }).click();
    await page.getByPlaceholder(/nome da categoria/i).fill(newCat);
    await page.getByRole('button', { name: /^criar$/i }).click();

    await expect(page.getByText(/categoria criada/i).first()).toBeVisible();
    // A nova categoria deve ficar selecionada como ativa
    await expect(page.getByRole('button', { name: newCat, exact: true })).toHaveAttribute('aria-pressed', 'true');
    // Form preservou o que estava digitado
    await expect(page.getByLabel(/descrição/i)).toHaveValue('Compra com categoria nova');
  });
});
