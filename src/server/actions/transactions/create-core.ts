import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import {
  createTransactionSchema,
  type CreateTransactionInput,
} from '@/lib/transactions/schema';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

export type CreateTransactionResult =
  | { ok: true; transaction: TransactionRow }
  | { ok: false; error: string; field?: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

/**
 * Cria uma transação de despesa. Função core (testável em integração) sem
 * dependência de next/headers. A Server Action é um wrapper fino que injeta
 * supabase + session.
 *
 * Garante:
 * - household_id e profile_id vêm da session (nunca do input).
 * - currency vem da conta no banco (nunca do input).
 * - status 'paid' apenas se input.paid for true; paid_on = date nesse caso.
 */
export async function createTransactionForSession(
  { supabase, session }: Deps,
  input: CreateTransactionInput
): Promise<CreateTransactionResult> {
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error: first?.message ?? 'Dados inválidos',
      field: first?.path[0]?.toString(),
    };
  }
  const data = parsed.data;

  // Deriva a moeda da conta — RLS garante que o usuário só vê contas do
  // próprio household, então se accountId for de outro household, vem null.
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('currency')
    .eq('id', data.accountId)
    .maybeSingle();
  if (accountError) {
    return { ok: false, error: 'Falha ao validar conta', field: 'accountId' };
  }
  if (!account) {
    return { ok: false, error: 'Conta inválida', field: 'accountId' };
  }

  // Categoria também precisa de check explícito: a FK transactions.category_id
  // sozinha aceita qualquer categoria, e a RLS de transactions só valida o
  // household da própria linha. Sem este SELECT, Tiago conseguiria gravar
  // transaction (no household dele) referenciando categoria de outro household.
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('id', data.categoryId)
    .maybeSingle();
  if (categoryError) {
    return { ok: false, error: 'Falha ao validar categoria', field: 'categoryId' };
  }
  if (!category) {
    return { ok: false, error: 'Categoria inválida', field: 'categoryId' };
  }

  const status = data.paid ? 'paid' : 'pending';
  const paid_on = data.paid ? data.date : null;

  const { data: inserted, error: insertError } = await supabase
    .from('transactions')
    .insert({
      household_id: session.householdId,
      profile_id: session.userId,
      account_id: data.accountId,
      category_id: data.categoryId,
      direction: 'expense',
      amount_cents: data.amountCents,
      currency: account.currency,
      description: data.description,
      occurred_on: data.date,
      paid_on,
      status,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? 'Não foi possível salvar',
    };
  }

  return { ok: true, transaction: inserted };
}
