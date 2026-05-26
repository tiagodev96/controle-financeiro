import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

type SnapshotRow = Database['public']['Tables']['account_balance_snapshots']['Row'];

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND = 'Snapshot não encontrado.';
const INVALID_ACCOUNT = 'Conta inválida.';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD esperado)');

const upsertSchema = z.object({
  accountId: z.string().uuid(),
  snapshotDate: dateSchema,
  balanceCents: z.number().int(),
});

const deleteSchema = z.object({
  snapshotId: z.string().uuid(),
});

const listSchema = z.object({
  accountId: z.string().uuid(),
  limit: z.number().int().positive().max(200).optional(),
});

export type SetSnapshotInput = z.input<typeof upsertSchema>;
export type DeleteSnapshotInput = z.input<typeof deleteSchema>;
export type ListSnapshotsInput = z.input<typeof listSchema>;

export type SnapshotMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

/**
 * Upsert manual de snapshot. Cria se não existe pra (account, date), ou
 * sobrescreve se já existe — sempre força `source='manual'`. Cron jamais
 * mexe num snapshot manual (ON CONFLICT DO NOTHING no upsert do cron).
 */
export async function setSnapshotCore(
  { supabase, session }: Deps,
  input: SetSnapshotInput,
): Promise<SnapshotMutationResult> {
  const parsed = upsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const { data: account } = await supabase
    .from('accounts')
    .select('id, household_id')
    .eq('id', data.accountId)
    .maybeSingle();
  if (!account || account.household_id !== session.householdId) {
    return { ok: false, error: INVALID_ACCOUNT };
  }

  const { error } = await supabase
    .from('account_balance_snapshots')
    .upsert(
      {
        household_id: session.householdId,
        account_id: data.accountId,
        snapshot_date: data.snapshotDate,
        balance_cents: data.balanceCents,
        source: 'manual',
      },
      { onConflict: 'account_id,snapshot_date' },
    );

  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

export async function deleteSnapshotCore(
  { supabase, session }: Deps,
  input: DeleteSnapshotInput,
): Promise<SnapshotMutationResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('account_balance_snapshots')
    .select('id, household_id')
    .eq('id', parsed.data.snapshotId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await supabase
    .from('account_balance_snapshots')
    .delete()
    .eq('id', parsed.data.snapshotId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

export async function listSnapshotsForAccount(
  { supabase, session }: Deps,
  input: ListSnapshotsInput,
): Promise<SnapshotRow[]> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return [];

  const { data } = await supabase
    .from('account_balance_snapshots')
    .select('*')
    .eq('household_id', session.householdId)
    .eq('account_id', parsed.data.accountId)
    .order('snapshot_date', { ascending: false })
    .limit(parsed.data.limit ?? 50);

  return (data ?? []) as SnapshotRow[];
}
