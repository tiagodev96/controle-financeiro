import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCreditCardCore } from '@/server/actions/credit-cards/core';
import { importCardStatementCore } from '@/server/actions/credit-cards/import-core';
import type { ParsedStatement } from '@/lib/finance/btg-statement';
import {
  getAuthedClient,
  SEED_SESSION,
  SEED_DEMO_HOUSEHOLD_ID,
  SEED_ACCOUNT_EUR_ID,
  SEED_ACCOUNT_BRL_ID,
  SEED_CATEGORY_MERCADO_ID,
} from './helpers/auth';
import { getAdminClient, truncateHouseholdTransactions } from './helpers/db';

async function cleanup(): Promise<void> {
  const admin = getAdminClient();
  await truncateHouseholdTransactions(SEED_DEMO_HOUSEHOLD_ID);
  await admin
    .from('recurring_rules')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('title', 'CARD test %');
  await admin
    .from('credit_cards')
    .delete()
    .eq('household_id', SEED_DEMO_HOUSEHOLD_ID)
    .like('name', 'CARD test %');
}

async function createCard(paymentAccountId = SEED_ACCOUNT_BRL_ID) {
  const supabase = await getAuthedClient();
  const created = await createCreditCardCore(
    { supabase, session: SEED_SESSION },
    {
      name: 'CARD test import',
      closingDay: 7,
      dueDay: 11,
      creditLimitCents: null,
      paymentAccountId,
    },
  );
  if (!created.ok) throw new Error(`setup: ${created.error}`);
  return { supabase, card: created.card };
}

const STATEMENT: ParsedStatement = {
  dueOn: '2026-09-11',
  monthLabel: 'Setembro/2026',
  ignoredCount: 1,
  statementTotalCents: 14688,
  purchases: [
    {
      purchasedOn: '2026-08-06',
      description: 'Mercado Livre',
      amountCents: 6799,
      externalRef: 'ZHIGHW',
      kind: 'avista',
      installment: null,
      cardLast4: '1906',
    },
    {
      purchasedOn: '2026-08-10',
      description: 'Chess',
      amountCents: 3918,
      externalRef: 'U61QUR',
      kind: 'internacional',
      installment: null,
      cardLast4: '7386',
    },
    {
      purchasedOn: '2026-09-05',
      description: 'Vestindo Essencia (1/2)',
      amountCents: 3971,
      externalRef: 'ECPXHV#1/2',
      kind: 'parcela',
      installment: { number: 1, total: 2 },
      cardLast4: '1906',
    },
  ],
};

describe('importar fatura (integração)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('I-CARD-IMP1 — importa compras como pending vencendo na data do arquivo, com categoria e external_ref', async () => {
    const { supabase, card } = await createCard();
    const result = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: STATEMENT, categoryId: SEED_CATEGORY_MERCADO_ID },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(3);
    expect(result.skippedExisting).toBe(0);
    expect(result.importedCents).toBe(14688);
    expect(result.importedFuture).toBe(1);
    expect(result.futureCents).toBe(3971);
    expect(result.dueOn).toBe('2026-09-11');

    const admin = getAdminClient();
    const { data: txns } = await admin
      .from('transactions')
      .select(
        'description, amount_cents, currency, status, occurred_on, purchased_on, external_ref, category_id, account_id, credit_card_id',
      )
      .eq('credit_card_id', card.id)
      .order('purchased_on', { ascending: true });
    expect(txns).toHaveLength(4);
    expect(txns!.every((t) => t.status === 'pending')).toBe(true);
    expect(txns!.every((t) => t.currency === 'BRL')).toBe(true);
    expect(txns!.every((t) => t.category_id === SEED_CATEGORY_MERCADO_ID)).toBe(true);
    expect(txns!.every((t) => t.account_id === SEED_ACCOUNT_BRL_ID)).toBe(true);
    expect(txns![0]).toMatchObject({
      description: 'Mercado Livre',
      amount_cents: 6799,
      purchased_on: '2026-08-06',
      external_ref: 'ZHIGHW',
    });
    expect(txns![2]!.external_ref).toBe('ECPXHV#1/2');

    // Parcela futura projetada: 2/2 na fatura seguinte, mesmo valor e data de compra.
    const future = txns!.find((t) => t.external_ref === 'ECPXHV#2/2');
    expect(future).toMatchObject({
      description: 'Vestindo Essencia (2/2)',
      amount_cents: 3971,
      occurred_on: '2026-10-11',
      purchased_on: '2026-09-05',
      status: 'pending',
      category_id: SEED_CATEGORY_MERCADO_ID,
    });
    const current = txns!.filter((t) => t.external_ref !== 'ECPXHV#2/2');
    expect(current.every((t) => t.occurred_on === '2026-09-11')).toBe(true);
  });

  it('I-CARD-IMP2 — reimportar o mesmo arquivo não duplica nada', async () => {
    const { supabase, card } = await createCard();
    const first = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: STATEMENT, categoryId: null },
    );
    expect(first.ok).toBe(true);

    const second = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: STATEMENT, categoryId: null },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.imported).toBe(0);
    expect(second.skippedExisting).toBe(3);
    expect(second.importedFuture).toBe(0);

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('credit_card_id', card.id);
    expect(count).toBe(4);
  });

  it('I-CARD-IMP3 — compra lançada à mão com mesma data e valor é pulada', async () => {
    const { supabase, card } = await createCard();
    const admin = getAdminClient();
    await admin.from('transactions').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_SESSION.userId,
      account_id: SEED_ACCOUNT_BRL_ID,
      direction: 'expense',
      amount_cents: 6799,
      currency: 'BRL',
      description: 'mercado livre manual',
      occurred_on: '2026-09-11',
      status: 'pending',
      credit_card_id: card.id,
      purchased_on: '2026-08-06',
    });

    const result = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: STATEMENT, categoryId: null },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(2);
    expect(result.skippedExisting).toBe(1);
  });

  it('I-CARD-IMP4 — dryRun calcula tudo sem inserir', async () => {
    const { supabase, card } = await createCard();
    const result = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: STATEMENT, categoryId: null, dryRun: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(3);
    expect(result.importedCents).toBe(14688);
    expect(result.importedFuture).toBe(1);

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('credit_card_id', card.id);
    expect(count).toBe(0);
  });

  it('I-CARD-IMP5 — cartão pago por conta EUR é rejeitado (fatura BTG é BRL)', async () => {
    const { supabase, card } = await createCard(SEED_ACCOUNT_EUR_ID);
    const result = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: STATEMENT, categoryId: null },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/BRL/);
  });

  it('I-CARD-IMP6 — categoria de outro household é rejeitada', async () => {
    const { supabase, card } = await createCard();
    const result = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      {
        cardId: card.id,
        statement: STATEMENT,
        categoryId: '00000000-0000-4000-8000-00000000dead',
      },
    );
    expect(result.ok).toBe(false);
  });
  it('I-CARD-IMP7 — fatura do mês seguinte com a parcela 2/2 real é pulada (já projetada)', async () => {
    const { supabase, card } = await createCard();
    const first = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: STATEMENT, categoryId: null },
    );
    expect(first.ok).toBe(true);

    const octoberStatement = {
      dueOn: '2026-10-11',
      monthLabel: 'Outubro/2026',
      ignoredCount: 0,
      statementTotalCents: 3971,
      purchases: [
        {
          purchasedOn: '2026-09-05',
          description: 'Vestindo Essencia (2/2)',
          amountCents: 3971,
          externalRef: 'ECPXHV#2/2',
          kind: 'parcela' as const,
          installment: { number: 2, total: 2 },
          cardLast4: '1906',
        },
      ],
    };
    const second = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement: octoberStatement, categoryId: null },
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.imported).toBe(0);
    expect(second.skippedExisting).toBe(1);
    expect(second.importedFuture).toBe(0);

    const admin = getAdminClient();
    const { count } = await admin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('credit_card_id', card.id)
      .eq('external_ref', 'ECPXHV#2/2');
    expect(count).toBe(1);
  });
  it('I-CARD-IMP8 — cobrança de recorrente no cartão deduplica com tolerância de ±3 dias', async () => {
    const { supabase, card } = await createCard();
    const admin = getAdminClient();
    // Compra gerada por recorrente (sem external_ref) em 15/09; o banco posta
    // a cobrança em 17/09 no arquivo — mesmo valor, 2 dias de diferença.
    const { data: rule } = await admin
      .from('recurring_rules')
      .insert({
        household_id: SEED_DEMO_HOUSEHOLD_ID,
        title: 'CARD test assinatura',
        amount_cents: 4999,
        currency: 'BRL',
        direction: 'expense',
        category_id: SEED_CATEGORY_MERCADO_ID,
        account_id: SEED_ACCOUNT_BRL_ID,
        day_of_month: 15,
        credit_card_id: card.id,
      })
      .select('id')
      .single();
    await admin.from('transactions').insert({
      household_id: SEED_DEMO_HOUSEHOLD_ID,
      profile_id: SEED_SESSION.userId,
      account_id: SEED_ACCOUNT_BRL_ID,
      direction: 'expense',
      amount_cents: 4999,
      currency: 'BRL',
      description: 'CARD test assinatura',
      occurred_on: '2026-10-11',
      status: 'pending',
      credit_card_id: card.id,
      purchased_on: '2026-09-15',
      source_recurring_rule_id: rule!.id,
    });

    const statement = {
      dueOn: '2026-10-11',
      monthLabel: 'Outubro/2026',
      ignoredCount: 0,
      statementTotalCents: 4999,
      purchases: [
        {
          purchasedOn: '2026-09-17',
          description: 'Google One',
          amountCents: 4999,
          externalRef: 'GOOG01',
          kind: 'avista' as const,
          installment: null,
          cardLast4: '1906',
        },
      ],
    };
    const result = await importCardStatementCore(
      { supabase, session: SEED_SESSION },
      { cardId: card.id, statement, categoryId: null },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toBe(0);
    expect(result.skippedExisting).toBe(1);
  });
});
