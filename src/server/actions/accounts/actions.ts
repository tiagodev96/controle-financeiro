'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  archiveAccountCore,
  createAccountCore,
  renameAccountCore,
  setAccountBalanceCore,
  unarchiveAccountCore,
  type AccountActionInput,
  type AccountMutationResult,
  type CreateAccountInput,
  type CreateAccountResult,
  type RenameAccountInput,
  type SetAccountBalanceInput,
} from './core';

function revalidateAll(): void {
  revalidatePath('/contas');
  revalidatePath('/lancar');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

export async function createAccountAction(
  input: CreateAccountInput,
): Promise<CreateAccountResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createAccountCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function renameAccountAction(
  input: RenameAccountInput,
): Promise<AccountMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await renameAccountCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function archiveAccountAction(
  input: AccountActionInput,
): Promise<AccountMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await archiveAccountCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function unarchiveAccountAction(
  input: AccountActionInput,
): Promise<AccountMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await unarchiveAccountCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function setAccountBalanceAction(
  input: SetAccountBalanceInput,
): Promise<AccountMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await setAccountBalanceCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}
