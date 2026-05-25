'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  closeDebtManuallyCore,
  createDebtCore,
  deleteDebtCore,
  reopenDebtCore,
  updateDebtCore,
  type CreateDebtInput,
  type CreateDebtResult,
  type DebtActionInput,
  type DebtMutationResult,
  type UpdateDebtInput,
} from './core';
import {
  registerDebtPaymentCore,
  type RegisterDebtPaymentInput,
  type RegisterDebtPaymentResult,
} from './register-payment-core';

function revalidateAll(): void {
  revalidatePath('/dividas');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

export async function createDebtAction(
  input: CreateDebtInput,
): Promise<CreateDebtResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createDebtCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function updateDebtAction(
  input: UpdateDebtInput,
): Promise<DebtMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await updateDebtCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function closeDebtManuallyAction(
  input: DebtActionInput,
): Promise<DebtMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await closeDebtManuallyCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function reopenDebtAction(
  input: DebtActionInput,
): Promise<DebtMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await reopenDebtCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteDebtAction(
  input: DebtActionInput,
): Promise<DebtMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteDebtCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function registerDebtPaymentAction(
  input: RegisterDebtPaymentInput,
): Promise<RegisterDebtPaymentResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await registerDebtPaymentCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}
