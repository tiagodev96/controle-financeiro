'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  allocateToEnvelopeCore,
  createEnvelopeCore,
  deleteEnvelopeCore,
  updateEnvelopeCore,
  withdrawFromEnvelopeCore,
  type CreateEnvelopeInput,
  type CreateEnvelopeResult,
  type EnvelopeActionInput,
  type EnvelopeMutationResult,
  type MoveEnvelopeInput,
  type UpdateEnvelopeInput,
} from './core';

function revalidateAll(): void {
  revalidatePath('/caixinhas');
  revalidatePath('/');
}

export async function createEnvelopeAction(
  input: CreateEnvelopeInput,
): Promise<CreateEnvelopeResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await createEnvelopeCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function updateEnvelopeAction(
  input: UpdateEnvelopeInput,
): Promise<EnvelopeMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await updateEnvelopeCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteEnvelopeAction(
  input: EnvelopeActionInput,
): Promise<EnvelopeMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteEnvelopeCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function allocateToEnvelopeAction(
  input: MoveEnvelopeInput,
): Promise<EnvelopeMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await allocateToEnvelopeCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function withdrawFromEnvelopeAction(
  input: MoveEnvelopeInput,
): Promise<EnvelopeMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await withdrawFromEnvelopeCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}
