import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/lib/fx';
import { getRateMapSafe } from '@/lib/fx';
import { planPaymentCoverage } from '@/lib/finance/payment-coverage';

export type RpcTransfer = {
  from_account_id: string;
  to_account_id: string;
  from_amount_cents: number;
  to_amount_cents: number;
  from_currency: Currency;
  to_currency: Currency;
  rate: number | null;
};

type Deps = {
  supabase: SupabaseClient<Database>;
  serviceSupabase?: SupabaseClient<Database>;
};

type Params = {
  expenseAccountId: string;
  amountCents: number;
  fxDate: string;
};

/**
 * Monta as transferências que cobrem o déficit de um pagamento puxando das
 * outras contas do household (mesma moeda primeiro, depois conversão). Devolve
 * o payload pronto pra RPC. Lista vazia quando não há déficit, não há outras
 * contas com saldo, ou o câmbio é necessário mas está indisponível.
 */
export async function buildCoverageTransfers(
  { supabase, serviceSupabase }: Deps,
  { expenseAccountId, amountCents, fxDate }: Params,
): Promise<RpcTransfer[]> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, currency, balance_cents, sort_order')
    .eq('is_archived', false);
  if (!accounts) return [];

  const expense = accounts.find((a) => a.id === expenseAccountId);
  if (!expense) return [];
  if (amountCents - expense.balance_cents <= 0) return [];

  const others = accounts.filter((a) => a.id !== expenseAccountId && a.balance_cents > 0);
  if (others.length === 0) return [];

  const needsFx = others.some((a) => a.currency !== expense.currency);
  let rateMap: { EUR_BRL: number; BRL_EUR: number } | null = null;
  if (needsFx && serviceSupabase) {
    rateMap = await getRateMapSafe({
      supabase,
      serviceSupabase,
      when: new Date(fxDate),
    });
  }

  const transfers = planPaymentCoverage({
    expenseAccountId,
    amountCents,
    accounts: accounts.map((a) => ({
      id: a.id,
      currency: a.currency as Currency,
      balanceCents: a.balance_cents,
      sortOrder: a.sort_order,
    })),
    rateMap,
  });

  return transfers.map((t) => ({
    from_account_id: t.fromAccountId,
    to_account_id: t.toAccountId,
    from_amount_cents: t.fromAmountCents,
    to_amount_cents: t.toAmountCents,
    from_currency: t.fromCurrency,
    to_currency: t.toCurrency,
    rate: t.rate,
  }));
}

export async function transactionHasCoverage(
  supabase: SupabaseClient<Database>,
  transactionId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('account_transfers')
    .select('id', { count: 'exact', head: true })
    .eq('source_transaction_id', transactionId);
  return (count ?? 0) > 0;
}
