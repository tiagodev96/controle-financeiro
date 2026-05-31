import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

function nextMonthIso(now = new Date()): string {
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
}

test.describe('Dashboard — sobra projetada do mês futuro', () => {
  test('E-DASH-PROJ — sobra prevista de mês futuro projeta recorrentes ainda não geradas', async ({
    page,
    context,
  }) => {
    await signInAsFixtureUser(context);

    const title = `RR proj ${Date.now()}`;
    await page.goto('/recorrentes');
    await expect(page.getByRole('heading', { name: /recorrentes/i })).toBeVisible();
    await page.getByRole('button', { name: /nova regra/i }).click();
    await page.getByPlaceholder(/ex: aluguel/i).fill(title);
    await page.getByLabel(/valor/i).fill('50000');
    await page.getByRole('button', { name: /criar regra/i }).click();
    await expect(page.getByText(title).first()).toBeVisible();

    await page.goto(`/?mes=${nextMonthIso()}`);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    const sobraCard = page
      .locator('div')
      .filter({ hasText: /sobra projetada/i })
      .filter({ hasText: /recorrentes/i });
    await expect(sobraCard.first()).toBeVisible();
  });
});
