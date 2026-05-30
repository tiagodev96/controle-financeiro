'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  setCategoryEssentialCore,
  type ReservaConfigResult,
  type SetEssentialInput,
} from './core';

function revalidateAll(): void {
  revalidatePath('/reserva');
  revalidatePath('/');
  revalidatePath('/caixinhas');
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
