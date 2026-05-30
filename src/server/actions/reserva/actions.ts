'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  setReserveEnvelopeCore,
  setCategoryEssentialCore,
  type ReservaConfigResult,
  type SetEssentialInput,
  type SetReserveInput,
} from './core';

function revalidateAll(): void {
  revalidatePath('/reserva');
  revalidatePath('/');
  revalidatePath('/caixinhas');
}

export async function setReserveEnvelopeAction(
  input: SetReserveInput,
): Promise<ReservaConfigResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await setReserveEnvelopeCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function setCategoryEssentialAction(
  input: SetEssentialInput,
): Promise<ReservaConfigResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await setCategoryEssentialCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}
