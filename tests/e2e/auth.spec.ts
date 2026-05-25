import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

test.describe('Auth (login com email + senha)', () => {
  test('E-A1 — login feliz com credenciais válidas do seed', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

    await page.getByLabel(/email/i).fill('tiago@example.com');
    await page.getByLabel(/senha/i).fill('password-local');
    await page.getByRole('button', { name: /^entrar$/i }).click();

    await expect(page).toHaveURL('/');
  });

  test('E-A2 — senha errada mostra alert genérico e preserva o email', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('tiago@example.com');
    await page.getByLabel(/senha/i).fill('senha-errada-de-proposito');
    await page.getByRole('button', { name: /^entrar$/i }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: /email ou senha inválidos/i })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel(/email/i)).toHaveValue('tiago@example.com');
    await expect(page.getByLabel(/senha/i)).toHaveValue('');
  });

  test('E-A3 — visitar rota protegida sem sessão redireciona pra /login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('M-A2 — já autenticado em /login → redireciona pra /', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    await page.goto('/login');

    await expect(page).toHaveURL('/');
  });
});
