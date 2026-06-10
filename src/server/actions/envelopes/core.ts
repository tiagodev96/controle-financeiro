import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

type EnvelopeRow = Database['public']['Tables']['envelopes']['Row'];

const GENERIC = 'Não foi possível salvar.';
const DUPLICATE = 'Já existe uma caixinha com esse nome.';
const NOT_FOUND = 'Caixinha não encontrada.';
const NEGATIVE = 'A caixinha ficaria com saldo negativo.';
const RESERVE_RENAME = 'A reserva não pode ser renomeada.';
const RESERVE_DELETE = 'A reserva não pode ser apagada.';

const nameSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Nome obrigatório').max(50, 'Máximo 50 caracteres'));

// Preserva undefined (campo ausente no patch ≠ limpar o valor); só número
// inválido/zero vira null explícito.
const targetSchema = z
  .number()
  .int()
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v == null || v <= 0 ? null : v));

const createSchema = z.object({
  name: nameSchema,
  currency: z.enum(['BRL', 'EUR']),
  targetCents: targetSchema,
  monthlyContributionCents: targetSchema,
  initialCents: z.number().int().nonnegative().optional(),
});

const updateSchema = z.object({
  envelopeId: z.string().uuid(),
  patch: z.object({
    name: nameSchema.optional(),
    targetCents: targetSchema,
    monthlyContributionCents: targetSchema,
  }),
});

const moveSchema = z.object({
  envelopeId: z.string().uuid(),
  cents: z.number().int().positive(),
});

const idSchema = z.object({ envelopeId: z.string().uuid() });

export type CreateEnvelopeInput = z.input<typeof createSchema>;
export type UpdateEnvelopeInput = z.input<typeof updateSchema>;
export type MoveEnvelopeInput = z.input<typeof moveSchema>;
export type EnvelopeActionInput = z.input<typeof idSchema>;

export type CreateEnvelopeResult =
  | { ok: true; envelope: EnvelopeRow }
  | { ok: false; error: string };
export type EnvelopeMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

function isDuplicateError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === '23505' || (err.message?.includes('duplicate') ?? false);
}

export async function createEnvelopeCore(
  { supabase, session }: Deps,
  input: CreateEnvelopeInput,
): Promise<CreateEnvelopeResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const { data: inserted, error } = await supabase
    .from('envelopes')
    .insert({
      household_id: session.householdId,
      name: data.name,
      currency: data.currency,
      target_cents: data.targetCents ?? null,
      monthly_contribution_cents: data.monthlyContributionCents ?? null,
      current_cents: data.initialCents ?? 0,
    })
    .select()
    .single();

  if (error) {
    return { ok: false, error: isDuplicateError(error) ? DUPLICATE : GENERIC };
  }
  if (!inserted) return { ok: false, error: GENERIC };
  return { ok: true, envelope: inserted };
}

export async function updateEnvelopeCore(
  { supabase, session }: Deps,
  input: UpdateEnvelopeInput,
): Promise<EnvelopeMutationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const { envelopeId, patch } = parsed.data;

  const { data: existing } = await supabase
    .from('envelopes')
    .select('id, household_id, is_reserve')
    .eq('id', envelopeId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }
  if (existing.is_reserve && patch.name !== undefined) {
    return { ok: false, error: RESERVE_RENAME };
  }

  const update: Database['public']['Tables']['envelopes']['Update'] = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.targetCents !== undefined) update.target_cents = patch.targetCents;
  if (patch.monthlyContributionCents !== undefined) {
    update.monthly_contribution_cents = patch.monthlyContributionCents;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from('envelopes').update(update).eq('id', envelopeId);
  if (error) {
    return { ok: false, error: isDuplicateError(error) ? DUPLICATE : GENERIC };
  }
  return { ok: true };
}

export async function deleteEnvelopeCore(
  { supabase, session }: Deps,
  input: EnvelopeActionInput,
): Promise<EnvelopeMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('envelopes')
    .select('id, household_id, is_reserve')
    .eq('id', parsed.data.envelopeId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }
  if (existing.is_reserve) {
    return { ok: false, error: RESERVE_DELETE };
  }

  const { error } = await supabase
    .from('envelopes')
    .delete()
    .eq('id', parsed.data.envelopeId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

async function adjustCurrent(
  { supabase, session }: Deps,
  envelopeId: string,
  delta: number,
): Promise<EnvelopeMutationResult> {
  const { data: existing } = await supabase
    .from('envelopes')
    .select('id, household_id, current_cents')
    .eq('id', envelopeId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const next = existing.current_cents + delta;
  if (next < 0) return { ok: false, error: NEGATIVE };

  const { error } = await supabase
    .from('envelopes')
    .update({ current_cents: next })
    .eq('id', envelopeId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

/** Aloca dinheiro pro envelope (incrementa current_cents). */
export async function allocateToEnvelopeCore(
  deps: Deps,
  input: MoveEnvelopeInput,
): Promise<EnvelopeMutationResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  return adjustCurrent(deps, parsed.data.envelopeId, parsed.data.cents);
}

/** Devolve dinheiro pro saldo livre (decrementa current_cents). */
export async function withdrawFromEnvelopeCore(
  deps: Deps,
  input: MoveEnvelopeInput,
): Promise<EnvelopeMutationResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  return adjustCurrent(deps, parsed.data.envelopeId, -parsed.data.cents);
}

export async function listEnvelopesForHousehold(
  { supabase, session }: Deps,
): Promise<EnvelopeRow[]> {
  const { data } = await supabase
    .from('envelopes')
    .select('*')
    .eq('household_id', session.householdId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []) as EnvelopeRow[];
}
