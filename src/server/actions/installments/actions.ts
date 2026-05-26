'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  createInstallmentPlanCore,
  deleteInstallmentPlanCore,
  updateInstallmentPlanCore,
  type CreateInstallmentPlanInput,
  type CreateInstallmentPlanResult,
  type DeleteInstallmentPlanInput,
  type InstallmentPlanMutationResult,
  type UpdateInstallmentPlanInput,
} from './core';

function revalidateAll(): void {
  revalidatePath('/parcelados');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

export async function createInstallmentPlanAction(
  input: CreateInstallmentPlanInput,
): Promise<CreateInstallmentPlanResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createInstallmentPlanCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteInstallmentPlanAction(
  input: DeleteInstallmentPlanInput,
): Promise<InstallmentPlanMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteInstallmentPlanCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function updateInstallmentPlanAction(
  input: UpdateInstallmentPlanInput,
): Promise<InstallmentPlanMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await updateInstallmentPlanCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}
