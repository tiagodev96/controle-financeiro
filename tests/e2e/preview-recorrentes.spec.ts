import { test, expect } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

function ym(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonthIso(now = new Date()): string {
  return ym(new Date(now.getFullYear(), now.getMonth() + 1, 1));
}
function currentMonthIso(now = new Date()): string {
  return ym(now);
}

async function createRecurringExpense(page: import('@playwright/test').Page, title: string, valor: string) {
  await page.goto('/recorrentes');
  await expect(page.getByRole('heading', { name: /recorrentes/i })).toBeVisible();
  await page.getByRole('button', { name: /nova regra/i }).click();
  await page.getByPlaceholder(/ex: aluguel/i).fill(title);
  await page.getByLabel(/valor/i).fill(valor);
  await page.getByRole('button', { name: /criar regra/i }).click();
  await expect(page.getByText(title).first()).toBeVisible();
}

test.describe('Preview de recorrentes em mês futuro', () => {
  test('E-PREV-TXN — recorrente vira linha "previsto" read-only na /transações de mês futuro', async ({
    page,
    context,
  }) => {
    await signInAsFixtureUser(context);
    const title = `Prev txn ${Date.now()}`;
    await createRecurringExpense(page, title, '3333');

    await page.goto(`/transacoes?mes=${nextMonthIso()}`);
    const row = page.getByTestId(`txn-row-previsto`).filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByText(/previsto/i)).toBeVisible();
    // read-only: sem botão de menu de ações na linha prevista
    await expect(row.getByRole('button')).toHaveCount(0);

    // mês corrente: a regra é gerada de verdade na criação → linha real, não "previsto"
    await page.goto(`/transacoes?mes=${currentMonthIso()}`);
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(
      page.getByTestId('txn-row-previsto').filter({ hasText: title }),
    ).toHaveCount(0);
  });
});
