'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  createCreditCardCore,
  updateCreditCardCore,
  deleteCreditCardCore,
  type CreateCreditCardInput,
  type CreateCreditCardResult,
  type UpdateCreditCardInput,
  type DeleteCreditCardInput,
  type CreditCardMutationResult,
} from './core';
import {
  createCardPurchaseCore,
  type CreateCardPurchaseInput,
  type CreateCardPurchaseResult,
} from './purchase-core';
import {
  payCardInvoiceCore,
  type PayCardInvoiceInput,
  type PayCardInvoiceResult,
} from './pay-invoice-core';
import {
  importCardStatementCore,
  type ImportCardStatementResult,
} from './import-core';
import { readBtgStatementFile } from './statement-file';

function revalidateAll(): void {
  revalidatePath('/cartoes');
  revalidatePath('/transacoes');
  revalidatePath('/parcelados');
  revalidatePath('/');
}

export async function createCreditCardAction(
  input: CreateCreditCardInput,
): Promise<CreateCreditCardResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createCreditCardCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function updateCreditCardAction(
  input: UpdateCreditCardInput,
): Promise<CreditCardMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await updateCreditCardCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteCreditCardAction(
  input: DeleteCreditCardInput,
): Promise<CreditCardMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteCreditCardCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function createCardPurchaseAction(
  input: CreateCardPurchaseInput,
): Promise<CreateCardPurchaseResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createCardPurchaseCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function payCardInvoiceAction(
  input: PayCardInvoiceInput,
): Promise<PayCardInvoiceResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await payCardInvoiceCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

const MAX_STATEMENT_BYTES = 2 * 1024 * 1024;

/**
 * Importa (ou pré-visualiza, mode=preview) a fatura xlsx do banco. FormData:
 * cardId, file, mode, password (opcional se já salva no cartão), categoryId
 * (opcional). Sucesso de import salva/atualiza a senha no cartão.
 */
export async function importCardStatementAction(
  formData: FormData,
): Promise<ImportCardStatementResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const cardId = formData.get('cardId');
  const mode = formData.get('mode');
  const file = formData.get('file');
  const passwordRaw = formData.get('password');
  const categoryRaw = formData.get('categoryId');

  if (typeof cardId !== 'string' || !(file instanceof File) || (mode !== 'preview' && mode !== 'import')) {
    return { ok: false, error: 'Dados inválidos.' };
  }
  if (file.size === 0 || file.size > MAX_STATEMENT_BYTES) {
    return { ok: false, error: 'Arquivo vazio ou grande demais (máx 2 MB).' };
  }

  const { data: card } = await supabase
    .from('credit_cards')
    .select('id, household_id, statement_password')
    .eq('id', cardId)
    .maybeSingle();
  if (!card || card.household_id !== session.householdId) {
    return { ok: false, error: 'Cartão inválido.' };
  }

  const typedPassword = typeof passwordRaw === 'string' ? passwordRaw.trim() : '';
  const password = typedPassword || card.statement_password || '';
  if (!password) {
    return { ok: false, error: 'Informe a senha da fatura.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await readBtgStatementFile(buffer, password);
  if (!parsed.ok) return parsed;

  const result = await importCardStatementCore(
    { supabase, session },
    {
      cardId,
      statement: parsed.statement,
      categoryId: typeof categoryRaw === 'string' && categoryRaw !== '' ? categoryRaw : null,
      dryRun: mode === 'preview',
    },
  );

  if (result.ok && mode === 'import') {
    if (typedPassword && typedPassword !== card.statement_password) {
      // Best-effort: falha aqui não desfaz o import — só não memoriza a senha.
      await supabase
        .from('credit_cards')
        .update({ statement_password: typedPassword })
        .eq('id', cardId);
    }
    revalidateAll();
  }
  return result;
}
