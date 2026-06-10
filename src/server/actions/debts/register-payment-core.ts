import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';

const GENERIC = 'Não foi possível registrar pagamento.';
const NOT_FOUND = 'Dívida não encontrada.';
const CURRENCY_MISMATCH = 'Conta em moeda diferente da dívida.';
const INVALID_ACCOUNT = 'Conta inválida.';
const DEBT_CLOSED = 'Dívida já está fechada.';

const DEBT_CATEGORY_NAME = 'Dívidas';
// Acima das categorias seedadas (sort_order 1-6) pra cair no fim do picker.
const DEBT_CATEGORY_SORT_ORDER = 99;

const inputSchema = z.object({
  debtId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  accountId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().transform((v) => v.trim()).pipe(z.string().min(1).max(200)),
});

export type RegisterDebtPaymentInput = z.input<typeof inputSchema>;
export type RegisterDebtPaymentResult =
  | { ok: true; closedDebt: boolean }
  | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

/**
 * Resolve (ou cria) a categoria "Dívidas" do household. Best-effort: qualquer
 * falha retorna null e o pagamento segue sem categoria — categorizar nunca
 * pode impedir o registro do pagamento.
 */
async function resolveDebtCategoryId(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<string | null> {
  const findExpenseCategory = () =>
    supabase
      .from('categories')
      .select('id')
      .eq('household_id', householdId)
      .eq('name', DEBT_CATEGORY_NAME)
      .eq('kind', 'expense')
      .maybeSingle();

  const { data: existing } = await findExpenseCategory();
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name: DEBT_CATEGORY_NAME,
      kind: 'expense',
      sort_order: DEBT_CATEGORY_SORT_ORDER,
    })
    .select('id')
    .single();
  if (created) return created.id;

  // 23505 = unique violation (household+name): ou corrida com outro pagamento
  // simultâneo (re-lê e recupera o id), ou o usuário tem uma categoria
  // "Dívidas" de outro kind (re-leitura filtra por expense e devolve null).
  if (insertError?.code !== '23505') return null;
  const { data: again } = await findExpenseCategory();
  return again?.id ?? null;
}

export async function registerDebtPaymentCore(
  { supabase, session }: Deps,
  input: RegisterDebtPaymentInput,
): Promise<RegisterDebtPaymentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };
  const data = parsed.data;

  // Lê a dívida pra validar household + currency + status
  const { data: debt } = await supabase
    .from('debts')
    .select('id, household_id, currency, status, remaining_amount_cents, title')
    .eq('id', data.debtId)
    .maybeSingle();
  if (!debt || debt.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }
  if (debt.status === 'closed') {
    return { ok: false, error: DEBT_CLOSED };
  }

  // Lê a conta pra validar household + currency
  const { data: account } = await supabase
    .from('accounts')
    .select('id, household_id, currency')
    .eq('id', data.accountId)
    .maybeSingle();
  if (!account || account.household_id !== session.householdId) {
    return { ok: false, error: INVALID_ACCOUNT };
  }
  if (account.currency !== debt.currency) {
    return { ok: false, error: CURRENCY_MISMATCH };
  }

  const categoryId = await resolveDebtCategoryId(supabase, session.householdId);

  const { error } = await supabase.from('transactions').insert({
    household_id: session.householdId,
    profile_id: session.userId,
    account_id: data.accountId,
    category_id: categoryId,
    direction: 'expense',
    amount_cents: data.amountCents,
    currency: account.currency,
    description: data.description,
    occurred_on: data.date,
    paid_on: data.date,
    status: 'paid',
    source_debt_id: data.debtId,
  });

  if (error) return { ok: false, error: GENERIC };

  // Re-lê a dívida pra saber se o trigger fechou
  const { data: after } = await supabase
    .from('debts')
    .select('status')
    .eq('id', data.debtId)
    .maybeSingle();

  return { ok: true, closedDebt: after?.status === 'closed' };
}
