import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

type AccountRow = Database['public']['Tables']['accounts']['Row'];

const GENERIC = 'Não foi possível salvar.';
const DUPLICATE = 'Já existe uma conta com esse nome.';
const NOT_FOUND = 'Conta não encontrada.';

const nameSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Nome obrigatório').max(50, 'Máximo 50 caracteres'));

const createSchema = z.object({
  name: nameSchema,
  currency: z.enum(['BRL', 'EUR']),
  initialBalanceCents: z.number().int().nonnegative(),
});

const renameSchema = z.object({
  accountId: z.string().uuid(),
  name: nameSchema,
});

const idSchema = z.object({ accountId: z.string().uuid() });

export type CreateAccountInput = z.input<typeof createSchema>;
export type RenameAccountInput = z.input<typeof renameSchema>;
export type AccountActionInput = z.input<typeof idSchema>;

export type CreateAccountResult =
  | { ok: true; account: AccountRow }
  | { ok: false; error: string };
export type AccountMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

function isDuplicateError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '23505' || (err.message?.includes('duplicate') ?? false);
}

export async function createAccountCore(
  { supabase, session }: Deps,
  input: CreateAccountInput,
): Promise<CreateAccountResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      household_id: session.householdId,
      name: parsed.data.name,
      currency: parsed.data.currency,
      balance_cents: parsed.data.initialBalanceCents,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: isDuplicateError(error) ? DUPLICATE : GENERIC };
  }
  if (!data) return { ok: false, error: GENERIC };
  return { ok: true, account: data };
}

export async function renameAccountCore(
  { supabase, session }: Deps,
  input: RenameAccountInput,
): Promise<AccountMutationResult> {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }

  const { data: existing } = await supabase
    .from('accounts')
    .select('id, household_id')
    .eq('id', parsed.data.accountId)
    .maybeSingle();
  if (!existing) return { ok: false, error: NOT_FOUND };
  if (existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await supabase
    .from('accounts')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.accountId);

  if (error) {
    return { ok: false, error: isDuplicateError(error) ? DUPLICATE : GENERIC };
  }
  return { ok: true };
}

async function setArchived(
  deps: Deps,
  input: AccountActionInput,
  value: boolean,
): Promise<AccountMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await deps.supabase
    .from('accounts')
    .select('id, household_id')
    .eq('id', parsed.data.accountId)
    .maybeSingle();
  if (!existing) return { ok: false, error: NOT_FOUND };
  if (existing.household_id !== deps.session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await deps.supabase
    .from('accounts')
    .update({ is_archived: value })
    .eq('id', parsed.data.accountId);

  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

export function archiveAccountCore(
  deps: Deps,
  input: AccountActionInput,
): Promise<AccountMutationResult> {
  return setArchived(deps, input, true);
}

export function unarchiveAccountCore(
  deps: Deps,
  input: AccountActionInput,
): Promise<AccountMutationResult> {
  return setArchived(deps, input, false);
}
