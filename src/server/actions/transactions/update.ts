'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession } from '@/lib/auth/session';
import {
  updateTransactionCore,
  type UpdateTransactionInput,
  type UpdateTransactionResult,
} from './update-core';

export async function updateTransactionAction(
  input: UpdateTransactionInput,
): Promise<UpdateTransactionResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await updateTransactionCore(
    { supabase, session, serviceSupabase: getServiceRoleSupabase() },
    input,
  );
  if (result.ok) {
    revalidatePath('/transacoes');
    revalidatePath('/');
  }
  return result;
}
