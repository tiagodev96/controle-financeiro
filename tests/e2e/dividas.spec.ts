import { test, expect, type Page, type Locator } from '@playwright/test';
import { signInAsFixtureUser } from '../helpers/auth';

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

async function pickDeadlineMonth(
  page: Page,
  dialog: Locator,
  yearDir: 'next' | 'prev',
  monthIndex: number,
): Promise<void> {
  await dialog.getByRole('button', { name: /quitar até/i }).click();
  await page.getByLabel(yearDir === 'next' ? 'Próximo ano' : 'Ano anterior').click();
  await page.getByRole('button', { name: new RegExp(`^${MONTHS_SHORT[monthIndex]}$`, 'i') }).click();
}

test.describe('Dívidas', () => {
  test('E-DB — cria dívida, registra pagamento parcial e depois quita', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `Jefferson ${Date.now()}`;

    await page.goto('/dividas');
    await expect(page.getByRole('heading', { name: /dívidas/i })).toBeVisible();

    // Cria dívida de €30,00 (3000 cents).
    await page.getByRole('button', { name: /nova dívida/i }).click();
    await page.getByPlaceholder(/empréstimo jefferson/i).fill(title);
    await page.getByLabel(/valor original/i).fill('3000');
    await page.getByRole('button', { name: /criar dívida/i }).click();

    const debtCard = page.locator(`[data-testid^="debt-row-"]`, { hasText: title });
    await expect(debtCard).toBeVisible();
    await expect(debtCard.getByText('€ 30,00').first()).toBeVisible();

    // Registra pagamento parcial €10,00 (1000 cents).
    await debtCard.getByRole('button', { name: /registrar pagamento/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/valor/i).fill('1000');
    await dialog.getByRole('button', { name: /registrar pagamento/i }).click();

    await expect(page.getByText(/pagamento registrado/i).first()).toBeVisible();

    // Restante deve cair pra €20,00 e progresso pra 33% (10/30).
    await expect(debtCard.getByText('€ 20,00').first()).toBeVisible();
    await expect(debtCard.getByText(/33% pago/i)).toBeVisible();

    // Registra o pagamento final €20,00.
    await debtCard.getByRole('button', { name: /registrar pagamento/i }).click();
    const dialog2 = page.getByRole('dialog');
    await dialog2.getByLabel(/valor/i).fill('2000');
    await dialog2.getByRole('button', { name: /registrar pagamento/i }).click();

    await expect(page.getByText(/dívida quitada/i).first()).toBeVisible();

    // Card desce pra Fechadas; recarrega só pra confirmar persistência.
    await page.reload();
    await expect(page.getByText(/fechadas/i).first()).toBeVisible();
    await expect(page.locator(`[data-testid^="debt-row-"]`, { hasText: title })).toBeVisible();
  });

  test('E-DB-DEADLINE — cria dívida com meta de quitação futura e mostra ritmo necessário', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `Meta ${Date.now()}`;
    const nextYearShort = String((new Date().getFullYear() + 1) % 100).padStart(2, '0');

    await page.goto('/dividas');
    await page.getByRole('button', { name: /nova dívida/i }).click();
    const dialog = page.getByRole('dialog');
    await page.getByPlaceholder(/empréstimo jefferson/i).fill(title);
    await page.getByLabel(/valor original/i).fill('5000');
    await pickDeadlineMonth(page, dialog, 'next', 5); // jun do próximo ano
    await page.getByRole('button', { name: /criar dívida/i }).click();

    const debtCard = page.locator(`[data-testid^="debt-row-"]`, { hasText: title });
    await expect(debtCard).toBeVisible();
    await expect(debtCard.getByText(new RegExp(`quitar até jun/${nextYearShort}`, 'i'))).toBeVisible();
    await expect(debtCard.getByText(/faltam \d+ meses/i)).toBeVisible();
    await expect(debtCard.getByText(/ritmo necessário/i)).toBeVisible();
  });

  test('E-DB-OVERDUE — meta vencida marca atrasada, oferece novo prazo e aparece no dashboard', async ({ page, context }) => {
    await signInAsFixtureUser(context);

    const title = `Cartao ${Date.now()}`;

    await page.goto('/dividas');
    await page.getByRole('button', { name: /nova dívida/i }).click();
    const dialog = page.getByRole('dialog');
    await page.getByPlaceholder(/empréstimo jefferson/i).fill(title);
    await page.getByLabel(/valor original/i).fill('5000');
    await pickDeadlineMonth(page, dialog, 'prev', 5); // jun do ano passado
    await page.getByRole('button', { name: /criar dívida/i }).click();

    const debtCard = page.locator(`[data-testid^="debt-row-"]`, { hasText: title });
    await expect(debtCard).toBeVisible();
    await expect(debtCard.getByText('atrasada', { exact: true })).toBeVisible();
    await expect(debtCard.getByRole('button', { name: /definir novo prazo/i })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /metas de quitação/i })).toBeVisible();
    await expect(
      page.locator('a', { hasText: title }).filter({ hasText: /venceu há/i }),
    ).toBeVisible();
  });
});
