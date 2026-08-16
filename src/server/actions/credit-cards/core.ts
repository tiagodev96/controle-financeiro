import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

type CardRow = Database['public']['Tables']['credit_cards']['Row'];

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND = 'Cartão não encontrado.';
const INVALID_ACCOUNT = 'Conta de pagamento inválida.';
const DUPLICATE_NAME = 'Já existe um cartão com esse nome.';

const nameSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Nome obrigatório').max(40, 'Máximo 40 caracteres'));

const daySchema = z.number().int().min(1).max(31);

const limitSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const createSchema = z.object({
  name: nameSchema,
  closingDay: daySchema,
  dueDay: daySchema,
  creditLimitCents: limitSchema,
  paymentAccountId: z.string().uuid(),
});

const updateSchema = z.object({
  cardId: z.string().uuid(),
  name: nameSchema.optional(),
  closingDay: daySchema.optional(),
  dueDay: daySchema.optional(),
  creditLimitCents: z.number().int().positive().nullable().optional(),
  paymentAccountId: z.string().uuid().optional(),
  isArchived: z.boolean().optional(),
});

const idSchema = z.object({ cardId: z.string().uuid() });

export type CreateCreditCardInput = z.input<typeof createSchema>;
export type UpdateCreditCardInput = z.input<typeof updateSchema>;
export type DeleteCreditCardInput = z.input<typeof idSchema>;

export type CreateCreditCardResult =
  | { ok: true; card: CardRow }
  | { ok: false; error: string };

export type CreditCardMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

async function validatePaymentAccount(
  supabase: SupabaseClient<Database>,
  session: Session,
  accountId: string,
): Promise<boolean> {
  // SELECT explícito: FK e RLS da própria linha não validam o household da
  // conta referenciada (mesma razão do check em transactions/create-core).
  const { data: account } = await supabase
    .from('accounts')
    .select('id, household_id')
    .eq('id', accountId)
    .maybeSingle();
  return !!account && account.household_id === session.householdId;
}

export async function createCreditCardCore(
  { supabase, session }: Deps,
  input: CreateCreditCardInput,
): Promise<CreateCreditCardResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  if (!(await validatePaymentAccount(supabase, session, data.paymentAccountId))) {
    return { ok: false, error: INVALID_ACCOUNT };
  }

  const { data: inserted, error } = await supabase
    .from('credit_cards')
    .insert({
      household_id: session.householdId,
      name: data.name,
      closing_day: data.closingDay,
      due_day: data.dueDay,
      credit_limit_cents: data.creditLimitCents,
      payment_account_id: data.paymentAccountId,
    })
    .select()
    .single();

  if (error || !inserted) {
    if (error?.code === '23505') return { ok: false, error: DUPLICATE_NAME };
    return { ok: false, error: GENERIC };
  }
  return { ok: true, card: inserted };
}

export async function updateCreditCardCore(
  { supabase, session }: Deps,
  input: UpdateCreditCardInput,
): Promise<CreditCardMutationResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const { data: existing } = await supabase
    .from('credit_cards')
    .select('id, household_id')
    .eq('id', data.cardId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  if (
    data.paymentAccountId &&
    !(await validatePaymentAccount(supabase, session, data.paymentAccountId))
  ) {
    return { ok: false, error: INVALID_ACCOUNT };
  }

  const patch: Database['public']['Tables']['credit_cards']['Update'] = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.closingDay !== undefined) patch.closing_day = data.closingDay;
  if (data.dueDay !== undefined) patch.due_day = data.dueDay;
  if ('creditLimitCents' in data) patch.credit_limit_cents = data.creditLimitCents;
  if (data.paymentAccountId !== undefined) patch.payment_account_id = data.paymentAccountId;
  if (data.isArchived !== undefined) patch.is_archived = data.isArchived;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from('credit_cards').update(patch).eq('id', data.cardId);
  if (error) {
    if (error.code === '23505') return { ok: false, error: DUPLICATE_NAME };
    return { ok: false, error: GENERIC };
  }
  return { ok: true };
}

export async function deleteCreditCardCore(
  { supabase, session }: Deps,
  input: DeleteCreditCardInput,
): Promise<CreditCardMutationResult> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('credit_cards')
    .select('id, household_id')
    .eq('id', parsed.data.cardId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  // Compras e planos ligados viram avulsos (FK on delete set null).
  const { error } = await supabase.from('credit_cards').delete().eq('id', parsed.data.cardId);
  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
