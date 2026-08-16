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

async function cleanup(): Promise<void> {
  const db = admin();
  await db.from('transactions').delete().eq('household_id', HOUSEHOLD_ID);
  await db
    .from('installment_plans')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .like('title', 'E2E card %');
  await db
    .from('credit_cards')
    .delete()
    .eq('household_id', HOUSEHOLD_ID)
    .like('name', 'E2E Cartão%');
  await db.from('accounts').update({ balance_cents: 0 }).eq('id', ACCOUNT_BRL_ID);
}

// Serial: os cenários compartilham o cartão criado no primeiro teste e o
// household do seed — paralelo aqui é race na certa.
test.describe.configure({ mode: 'serial' });

test.describe('Cartão de crédito', () => {
  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test('E-CARD1 — cria cartão e lança compra que cai na fatura do ciclo seguinte', async ({
    page,
    context,
  }) => {
    await signInAsFixtureUser(context);

    // Cria o cartão (fecha 7, vence 11).
    await page.goto('/cartoes');
    await page.getByRole('button', { name: 'Novo cartão' }).click();
    await page.getByLabel('Nome').fill('E2E Cartão Nubank');
    await page.getByRole('combobox', { name: 'Conta que paga a fatura' }).click();
    await page.getByRole('option', { name: /Conta principal BRL/ }).click();
    await page.getByRole('button', { name: 'Criar cartão' }).click();
    await expect(page.getByText('Cartão criado.')).toBeVisible();
    await expect(page.getByText(/melhor dia pra comprar: 8/i).first()).toBeVisible();

    // Lança compra de R$ 120,50 em 08/08 → deve vencer 11/09.
    await page.goto('/lancar');
    await page.getByLabel('Valor').fill('120,50');
    await page.getByPlaceholder('Ex: Pão na padaria').fill('E2E card mercado');
    await page.getByRole('combobox', { name: 'Pagar com' }).click();
    await page.getByRole('option', { name: /E2E Cartão Nubank/ }).click();
    await page.locator('input[name="data"]').fill('2026-08-08');
    await expect(page.getByTestId('card-due-preview')).toContainText('11/09');
    // Toggle "Já pago" não existe no modo cartão.
    await expect(page.getByRole('button', { name: 'Já pago' })).toHaveCount(0);
    await page.getByRole('button', { name: /Lançar despesa/ }).click();
    await expect(page.getByText(/Compra no cartão lançada/i)).toBeVisible();

    // Aparece em /transacoes no mês do vencimento (setembro) com pill CARTÃO.
    await page.goto('/transacoes?mes=2026-09');
    await expect(page.getByText('E2E card mercado')).toBeVisible();
    await expect(page.getByText('Cartão', { exact: true }).first()).toBeVisible();

    // E na fatura de 11/09 em /cartoes.
    await page.goto('/cartoes');
    await expect(page.getByText('Fatura 11/09').first()).toBeVisible();
    await expect(page.getByText('E2E card mercado')).toBeVisible();
  });

  test('E-CARD2 — compra parcelada 3× gera parcelas em faturas consecutivas', async ({
    page,
    context,
  }) => {
    await signInAsFixtureUser(context);

    await page.goto('/lancar');
    await page.getByLabel('Valor').fill('300,00');
    await page.getByPlaceholder('Ex: Pão na padaria').fill('E2E card sofá');
    await page.getByRole('combobox', { name: 'Pagar com' }).click();
    await page.getByRole('option', { name: /E2E Cartão Nubank/ }).click();
    await page.locator('input[name="data"]').fill('2026-08-08');
    await page.getByRole('combobox', { name: 'Parcelas' }).click();
    await page.getByRole('option', { name: '3×', exact: true }).click();
    await expect(page.getByTestId('card-due-preview')).toContainText('3× R$ 100,00');
    await page.getByRole('button', { name: /Lançar despesa/ }).click();
    await expect(page.getByText(/Compra no cartão lançada/i)).toBeVisible();

    // 3 parcelas em setembro, outubro e novembro.
    const db = admin();
    const { data: txns } = await db
      .from('transactions')
      .select('occurred_on, description')
      .like('description', 'E2E card sofá%')
      .order('occurred_on', { ascending: true });
    expect(txns?.map((t) => t.occurred_on)).toEqual(['2026-09-11', '2026-10-11', '2026-11-11']);
  });

  test('E-CARD3 — pagar fatura marca compras como pagas e debita a conta uma vez', async ({
    page,
    context,
  }) => {
    await signInAsFixtureUser(context);
    const db = admin();
    await db.from('accounts').update({ balance_cents: 100000 }).eq('id', ACCOUNT_BRL_ID);

    // Compra que cai na fatura de 11/08 (já fechada em 16/08, data dos testes).
    const { data: card } = await db
      .from('credit_cards')
      .select('id')
      .eq('household_id', HOUSEHOLD_ID)
      .like('name', 'E2E Cartão%')
      .single();
    await db.from('transactions').insert({
      household_id: HOUSEHOLD_ID,
      profile_id: '00000000-0000-4000-8000-000000000001',
      account_id: ACCOUNT_BRL_ID,
      category_id: '33333333-3333-4333-8333-333333333001',
      direction: 'expense',
      amount_cents: 25000,
      currency: 'BRL',
      description: 'E2E card fatura fechada',
      occurred_on: '2026-08-11',
      status: 'pending',
      credit_card_id: card!.id,
      purchased_on: '2026-08-05',
    });

    await page.goto('/cartoes');
    await page.getByRole('button', { name: 'Pagar fatura' }).click();
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect(page.getByText('Fatura paga.')).toBeVisible();

    const { data: paid } = await db
      .from('transactions')
      .select('status')
      .eq('description', 'E2E card fatura fechada')
      .single();
    expect(paid?.status).toBe('paid');

    const { data: account } = await db
      .from('accounts')
      .select('balance_cents')
      .eq('id', ACCOUNT_BRL_ID)
      .single();
    expect(account?.balance_cents).toBe(100000 - 25000);
  });

  test('E-CARD4 — dashboard mostra o bloco do cartão com a fatura aberta', async ({
    page,
    context,
  }) => {
    await signInAsFixtureUser(context);
    await page.goto('/');

    const block = page.getByTestId('dashboard-card-block');
    await expect(block).toBeVisible();
    await expect(block.getByText('E2E Cartão Nubank')).toBeVisible();
    await expect(block.getByText('Fatura aberta')).toBeVisible();
  });
});
