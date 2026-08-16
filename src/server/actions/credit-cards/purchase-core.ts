import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { cycleForPurchase } from '@/lib/finance/credit-card';
import { createInstallmentPlanCore } from '@/server/actions/installments/core';

const GENERIC = 'Não foi possível salvar.';
const INVALID_CARD = 'Cartão inválido.';
const INVALID_CATEGORY = 'Categoria inválida.';

const purchaseSchema = z.object({
  cardId: z.string().uuid(),
  amountCents: z.number().int().positive('Valor deve ser maior que zero'),
  description: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, 'Descrição é obrigatória').max(200, 'Máximo 200 caracteres')),
  categoryId: z.string().uuid(),
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  installments: z.number().int().min(1).max(24),
});

export type CreateCardPurchaseInput = z.input<typeof purchaseSchema>;

export type CreateCardPurchaseResult =
  | { ok: true; dueOn: string }
  | { ok: false; error: string; field?: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

/**
 * Compra no cartão: à vista vira uma transaction pendente vencendo na fatura
 * do ciclo; parcelada vira um installment_plan etiquetado com o cartão (a
 * geração das N parcelas é a mesma de /parcelados). A moeda vem da conta que
 * paga a fatura — compra no cartão nunca nasce paga.
 */
export async function createCardPurchaseCore(
  { supabase, session }: Deps,
  input: CreateCardPurchaseInput,
): Promise<CreateCardPurchaseResult> {
  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? GENERIC, field: first?.path[0]?.toString() };
  }
  const data = parsed.data;

  const { data: card } = await supabase
    .from('credit_cards')
    .select('id, household_id, closing_day, due_day, payment_account_id, is_archived')
    .eq('id', data.cardId)
    .maybeSingle();
  if (!card || card.household_id !== session.householdId || card.is_archived) {
    return { ok: false, error: INVALID_CARD, field: 'cardId' };
  }

  const { data: account } = await supabase
    .from('accounts')
    .select('id, currency')
    .eq('id', card.payment_account_id)
    .maybeSingle();
  if (!account) {
    return { ok: false, error: INVALID_CARD, field: 'cardId' };
  }

  const { data: category } = await supabase
    .from('categories')
    .select('id, household_id')
    .eq('id', data.categoryId)
    .maybeSingle();
  if (!category || category.household_id !== session.householdId) {
    return { ok: false, error: INVALID_CATEGORY, field: 'categoryId' };
  }

  const { dueOn } = cycleForPurchase(data.purchasedOn, card.closing_day, card.due_day);

  if (data.installments > 1) {
    const result = await createInstallmentPlanCore(
      { supabase, session },
      {
        title: data.description,
        totalAmountCents: data.amountCents,
        currency: account.currency as 'EUR' | 'BRL',
        totalInstallments: data.installments,
        firstDueDate: dueOn,
        frequencyMonths: 1,
        categoryId: data.categoryId,
        accountId: card.payment_account_id,
        notes: null,
        card: { creditCardId: card.id, purchasedOn: data.purchasedOn },
      },
    );
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, dueOn };
  }

  const { error } = await supabase.from('transactions').insert({
    household_id: session.householdId,
    profile_id: session.userId,
    account_id: card.payment_account_id,
    category_id: data.categoryId,
    direction: 'expense',
    amount_cents: data.amountCents,
    currency: account.currency,
    description: data.description,
    occurred_on: dueOn,
    paid_on: null,
    status: 'pending',
    credit_card_id: card.id,
    purchased_on: data.purchasedOn,
  });

  if (error) return { ok: false, error: GENERIC };
  return { ok: true, dueOn };
}
