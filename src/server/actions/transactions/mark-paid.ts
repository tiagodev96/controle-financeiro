'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession } from '@/lib/auth/session';
import { markPaidCore, type MarkPaidInput, type MarkPaidResult } from './mark-paid-core';

export async function marcarTransacaoComoPago(
  input: MarkPaidInput,
): Promise<MarkPaidResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await markPaidCore(
    { supabase, session, serviceSupabase: getServiceRoleSupabase() },
    input,
  );
  if (result.ok) {
    revalidatePath('/transacoes');
    revalidatePath('/');
  }
  return result;
}
