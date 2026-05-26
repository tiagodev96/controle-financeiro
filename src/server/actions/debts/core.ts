import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

type DebtRow = Database['public']['Tables']['debts']['Row'];

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND = 'Dívida não encontrada.';

const titleSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Título obrigatório').max(80, 'Máximo 80 caracteres'));

const notesSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v == null || v.trim() === '' ? null : v.trim().slice(0, 200)));

const createSchema = z.object({
  title: titleSchema,
  originalAmountCents: z.number().int().positive(),
  currency: z.enum(['BRL', 'EUR']),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  notes: notesSchema,
});

const updateSchema = z.object({
  debtId: z.string().uuid(),
  patch: z.object({
    title: titleSchema.optional(),
    originalAmountCents: z.number().int().positive().optional(),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    notes: notesSchema,
  }),
});

const idSchema = z.object({ debtId: z.string().uuid() });

export type CreateDebtInput = z.input<typeof createSchema>;
export type UpdateDebtInput = z.input<typeof updateSchema>;
export type DebtActionInput = z.input<typeof idSchema>;

export type CreateDebtResult =
  | { ok: true; debt: DebtRow }
  | { ok: false; error: string };
export type DebtMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

export async function createDebtCore(
  { supabase, session }: Deps,
  input: CreateDebtInput,
): Promise<CreateDebtResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const { data: inserted, error } = await supabase
    .from('debts')
    .insert({
      household_id: session.householdId,
      title: data.title,
      original_amount_cents: data.originalAmountCents,
      remaining_amount_cents: data.originalAmountCents,
      currency: data.currency,
      priority: data.priority,
      notes: data.notes,
    })
    .select()
    .single();

  if (error || !inserted) return { ok: false, error: GENERIC };
  return { ok: true, debt: inserted };
}

export async function updateDebtCore(
  { supabase, session }: Deps,
  input: UpdateDebtInput,
): Promise<DebtMutationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const { debtId, patch } = parsed.data;

  const { data: existing } = await supabase
    .from('debts')
    .select('id, household_id, original_amount_cents')
    .eq('id', debtId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const update: Database['public']['Tables']['debts']['Update'] = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.notes !== undefined) update.notes = patch.notes;

  // Mudar o valor original obriga recalcular remaining + status (o trigger
  // de pagamentos só dispara em insert/update/delete de transactions).
  if (
    patch.originalAmountCents !== undefined &&
    patch.originalAmountCents !== existing.original_amount_cents
  ) {
    const { data: paidRows, error: paidErr } = await supabase
      .from('transactions')
      .select('amount_cents')
      .eq('source_debt_id', debtId)
      .eq('status', 'paid');
    if (paidErr) return { ok: false, error: GENERIC };

    const paidSum = (paidRows ?? []).reduce((s, r) => s + r.amount_cents, 0);
    const newRemaining = Math.max(patch.originalAmountCents - paidSum, 0);
    update.original_amount_cents = patch.originalAmountCents;
    update.remaining_amount_cents = newRemaining;
    update.status = newRemaining > 0 ? 'open' : 'closed';
    update.closed_at = newRemaining > 0 ? null : new Date().toISOString();
  }

  const { error } = await supabase.from('debts').update(update).eq('id', debtId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

async function setStatus(
  deps: Deps,
  input: DebtActionInput,
  status: 'open' | 'closed',
): Promise<DebtMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await deps.supabase
    .from('debts')
    .select('id, household_id')
    .eq('id', parsed.data.debtId)
    .maybeSingle();
  if (!existing || existing.household_id !== deps.session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await deps.supabase
    .from('debts')
    .update({
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', parsed.data.debtId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}

export function closeDebtManuallyCore(
  deps: Deps,
  input: DebtActionInput,
): Promise<DebtMutationResult> {
  return setStatus(deps, input, 'closed');
}

export function reopenDebtCore(
  deps: Deps,
  input: DebtActionInput,
): Promise<DebtMutationResult> {
  return setStatus(deps, input, 'open');
}

export async function deleteDebtCore(
  { supabase, session }: Deps,
  input: DebtActionInput,
): Promise<DebtMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('debts')
    .select('id, household_id')
    .eq('id', parsed.data.debtId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await supabase.from('debts').delete().eq('id', parsed.data.debtId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
