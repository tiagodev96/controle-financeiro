import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import {
  createTransactionSchema,
  type CreateTransactionInput,
} from '@/lib/transactions/schema';
import { buildCoverageTransfers } from './coverage';

type TransactionRow = Database['public']['Tables']['transactions']['Row'];

export type CreateTransactionResult =
  | { ok: true; transaction: TransactionRow }
  | { ok: false; error: string; field?: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
  serviceSupabase?: SupabaseClient<Database>;
};

export async function createTransactionForSession(
  { supabase, session, serviceSupabase }: Deps,
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

  // currency vem da conta no banco — RLS garante que só vemos contas do
  // próprio household, então accountId fora dele retorna null.
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('currency, balance_cents')
    .eq('id', data.accountId)
    .maybeSingle();
  if (accountError) {
    return { ok: false, error: 'Falha ao validar conta', field: 'accountId' };
  }
  if (!account) {
    return { ok: false, error: 'Conta inválida', field: 'accountId' };
  }

  // SELECT explícito da categoria: a FK e a RLS de transactions só validam o
  // household da própria linha. Sem este check, conseguiríamos gravar uma
  // transaction no nosso household referenciando categoria de outro.
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

  // Despesa paga numa conta sem saldo: cobre o déficit puxando de outras contas
  // (conversão se necessário). Insere despesa + transferências + saldos via RPC
  // numa transação única. Sem cobertura possível, segue o caminho inline abaixo.
  if (data.paid && data.updateBalance && data.direction === 'expense') {
    const transfers = await buildCoverageTransfers(
      { supabase, serviceSupabase },
      { expenseAccountId: data.accountId, amountCents: data.amountCents, fxDate: data.date },
    );
    if (transfers.length > 0) {
      const { data: row, error: rpcError } = await supabase.rpc(
        'create_paid_transaction_with_coverage',
        {
          p_account_id: data.accountId,
          p_category_id: data.categoryId,
          p_direction: data.direction,
          p_amount_cents: data.amountCents,
          p_currency: account.currency,
          p_description: data.description,
          p_occurred_on: data.date,
          p_paid_on: data.date,
          p_transfers: transfers,
        },
      );
      if (rpcError || !row) {
        return { ok: false, error: rpcError?.message ?? 'Não foi possível salvar' };
      }
      return { ok: true, transaction: row as TransactionRow };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('transactions')
    .insert({
      household_id: session.householdId,
      profile_id: session.userId,
      account_id: data.accountId,
      category_id: data.categoryId,
      direction: data.direction,
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

  if (data.paid && data.updateBalance) {
    const delta = data.direction === 'income' ? data.amountCents : -data.amountCents;
    const { error: balanceError } = await supabase
      .from('accounts')
      .update({ balance_cents: account.balance_cents + delta })
      .eq('id', data.accountId);
    if (balanceError) {
      // A transaction já existe; falhar aqui geraria duplicata no retry.
      // O saldo é editável manualmente — loga e segue.
      console.error(
        `create-transaction: saldo da conta ${data.accountId} não atualizado: ${balanceError.message}`,
      );
    }
  }

  return { ok: true, transaction: inserted };
}
