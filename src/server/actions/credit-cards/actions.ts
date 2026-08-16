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
