'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  createRecurringCore,
  deleteRecurringCore,
  pauseRecurringCore,
  resumeRecurringCore,
  updateRecurringCore,
  type CreateRecurringInput,
  type CreateRecurringResult,
  type RecurringActionInput,
  type RecurringMutationResult,
  type UpdateRecurringInput,
} from './core';
import {
  generateRecurringForMonthCore,
  type GenerateInput,
  type GenerateResult,
} from './generate-core';
import { monthIso } from '@/lib/dates';

function revalidateAll(): void {
  revalidatePath('/recorrentes');
  revalidatePath('/transacoes');
  revalidatePath('/');
}

export async function createRecurringAction(
  input: CreateRecurringInput,
): Promise<CreateRecurringResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createRecurringCore({ supabase, session }, input);
  if (result.ok) {
    // Gera imediatamente a transaction do mês corrente — sem isso a regra
    // fica "fantasma" até o cron do dia 1 do mês seguinte rodar. A geração
    // é idempotente: se já existir por algum motivo, é pulada.
    await generateRecurringForMonthCore(
      { supabase, session },
      { monthIso: monthIso(new Date()) },
    );
    revalidateAll();
  }
  return result;
}

export async function updateRecurringAction(
  input: UpdateRecurringInput,
): Promise<RecurringMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await updateRecurringCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function pauseRecurringAction(
  input: RecurringActionInput,
): Promise<RecurringMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await pauseRecurringCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function resumeRecurringAction(
  input: RecurringActionInput,
): Promise<RecurringMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await resumeRecurringCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteRecurringAction(
  input: RecurringActionInput,
): Promise<RecurringMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteRecurringCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function generateRecurringForMonthAction(
  input: GenerateInput,
): Promise<GenerateResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await generateRecurringForMonthCore({ supabase, session }, input);
  if (result.ok && result.created > 0) revalidateAll();
  return result;
}
