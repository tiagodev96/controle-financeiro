'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import {
  deleteTransactionCore,
  type DeleteTransactionInput,
  type DeleteTransactionResult,
} from './delete-core';

export async function deleteTransactionAction(
  input: DeleteTransactionInput,
): Promise<DeleteTransactionResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteTransactionCore({ supabase, session }, input);
  if (result.ok) {
    revalidatePath('/transacoes');
    revalidatePath('/');
  }
  return result;
}
