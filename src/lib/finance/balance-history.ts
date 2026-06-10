import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { toIsoDate } from '@/lib/dates';

export type BalanceLookup = {
  cents: number;
  /** 'snapshot' = veio do histórico capturado; 'live' = fallback do balance atual. */
  source: 'snapshot' | 'live';
  /** Data do snapshot usado (ISO YYYY-MM-DD), se source='snapshot'. */
  snapshotDate?: string;
};

/**
 * Retorna o saldo de uma conta em uma data passada usando o snapshot mais
 * recente com snapshot_date <= date. Cai pra balance vivo se não existe
 * snapshot ainda (account criada após o último cron, ou cron ainda não rodou
 * pela primeira vez).
 */
export async function getBalanceOn(
  supabase: SupabaseClient<Database>,
  accountId: string,
  date: Date,
  liveBalanceFallback: number,
): Promise<BalanceLookup> {
  const isoDate = toIsoDate(date);

  const { data } = await supabase
    .from('account_balance_snapshots')
    .select('balance_cents, snapshot_date')
    .eq('account_id', accountId)
    .lte('snapshot_date', isoDate)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      cents: data.balance_cents,
      source: 'snapshot',
      snapshotDate: data.snapshot_date,
    };
  }

  return { cents: liveBalanceFallback, source: 'live' };
}

export type BalanceByAccount = Record<string, BalanceLookup>;

/**
 * Versão batch: resolve o saldo histórico de várias accounts em paralelo.
 * `accounts` precisa trazer `id` e `balance_cents` (pra fallback).
 */
export async function getBalanceByAccountOn(
  supabase: SupabaseClient<Database>,
  accounts: { id: string; balance_cents: number }[],
  date: Date,
): Promise<BalanceByAccount> {
  const entries = await Promise.all(
    accounts.map(async (a) => {
      const lookup = await getBalanceOn(supabase, a.id, date, a.balance_cents);
      return [a.id, lookup] as const;
    }),
  );
  return Object.fromEntries(entries);
}
