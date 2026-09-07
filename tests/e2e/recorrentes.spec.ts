import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsFixtureUser } from '../helpers/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_BRL_ID = '22222222-2222-4222-8222-222222222002';

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
  test('E-RR-CARD — regra paga no cartão gera compra que cai na fatura', async ({
    page,
    context,
  }) => {
    await signInAsFixtureUser(context);
    const db = admin();
    const title = `RR streaming ${Date.now()}`;

    // Cartão fecha 7 / vence 11 direto no banco (o fluxo de criação de cartão
    // pela UI já é coberto em cartoes.spec).
    const { data: card } = await db
      .from('credit_cards')
      .insert({
        household_id: HOUSEHOLD_ID,
        name: `E2E RR Cartão ${Date.now()}`,
        closing_day: 7,
        due_day: 11,
        payment_account_id: ACCOUNT_BRL_ID,
      })
      .select('id, name')
      .single();

    try {
      await page.goto('/recorrentes');
      await page.getByRole('button', { name: /nova regra/i }).click();
      await page.getByPlaceholder(/ex: aluguel/i).fill(title);
      await page.getByLabel(/valor/i).fill('49,99');
      await page.getByRole('combobox', { name: 'Pagar com' }).click();
      await page.getByRole('option', { name: new RegExp(`${card!.name} \\(cartão\\)`) }).click();
      await page.getByRole('button', { name: /criar regra/i }).click();

      await expect(page.getByText(title).first()).toBeVisible();
      await expect(page.getByText(/na fatura do cartão/i).first()).toBeVisible();

      await page.getByRole('button', { name: /gerar este mês/i }).click();
      await expect(
        page.getByText(/(geradas \d+ transaç|tudo já lançado)/i).first(),
      ).toBeVisible();

      // A geração virou compra de cartão: purchased_on no mês, vencendo na fatura.
      const { data: txns } = await db
        .from('transactions')
        .select('credit_card_id, purchased_on, occurred_on, amount_cents, status')
        .eq('description', title);
      expect(txns).toHaveLength(1);
      const txn = txns![0]!;
      expect(txn.credit_card_id).toBe(card!.id);
      expect(txn.amount_cents).toBe(4999);
      expect(txn.status).toBe('pending');
      expect(txn.purchased_on).not.toBeNull();
      expect(txn.occurred_on! > txn.purchased_on!).toBe(true);
    } finally {
      await db.from('transactions').delete().eq('description', title);
      await db.from('recurring_rules').delete().eq('title', title);
      await db.from('credit_cards').delete().eq('id', card!.id);
    }
  });
});
