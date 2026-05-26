'use server';

import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import type { Database } from '@/types/database';
import {
  deleteSnapshotCore,
  listSnapshotsForAccount,
  setSnapshotCore,
  type DeleteSnapshotInput,
  type ListSnapshotsInput,
  type SetSnapshotInput,
  type SnapshotMutationResult,
} from './core';

type SnapshotRow = Database['public']['Tables']['account_balance_snapshots']['Row'];

function revalidateAll(): void {
  revalidatePath('/contas');
  revalidatePath('/resumo');
  revalidatePath('/');
}

export async function setSnapshotAction(
  input: SetSnapshotInput,
): Promise<SnapshotMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await setSnapshotCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function deleteSnapshotAction(
  input: DeleteSnapshotInput,
): Promise<SnapshotMutationResult> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const result = await deleteSnapshotCore({ supabase, session }, input);
  if (result.ok) revalidateAll();
  return result;
}

export async function listSnapshotsAction(
  input: ListSnapshotsInput,
): Promise<SnapshotRow[]> {
  const session = await getSession();
  const supabase = await getServerSupabase();
  return listSnapshotsForAccount({ supabase, session }, input);
}
