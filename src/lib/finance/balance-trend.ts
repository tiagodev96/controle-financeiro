import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';
import { toIsoDate } from '@/lib/dates';

export type TrendPoint = {
  /** ISO YYYY-MM-DD. */
  date: string;
  /** Soma dos snapshots dessa data, na currency pedida (cents). */
  totalCents: number;
  /** Quantos snapshots concorreram pra esse ponto. */
  accountsCount: number;
};

type SnapshotRow = {
  account_id: string;
  snapshot_date: string;
  balance_cents: number;
  accounts: { currency: string } | null;
};

/**
 * Agrega snapshots por data pra uma currency, últimas N semanas. Cada ponto
 * é a soma dos balance_cents de todas as accounts dessa currency com
 * snapshot naquele dia. Datas sem snapshot ficam fora — o chart conecta
 * pontos via interpolação visual.
 */
export async function listSnapshotsForChart(
  supabase: SupabaseClient<Database>,
  householdId: string,
  currency: Currency,
  weeks = 26,
): Promise<TrendPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceIso = toIsoDate(since);

  const { data, error } = await supabase
    .from('account_balance_snapshots')
    .select('account_id, snapshot_date, balance_cents, accounts!inner(currency)')
    .eq('household_id', householdId)
    .gte('snapshot_date', sinceIso)
    .order('snapshot_date', { ascending: true });

  if (error || !data) return [];

  // Supabase pode retornar `accounts` como array ou objeto dependendo da inferência —
  // normaliza pra um único objeto pra simplificar o filtro.
  const rows = (data as unknown as SnapshotRow[]).filter(
    (r) => r.accounts?.currency === currency,
  );

  const byDate = new Map<string, { totalCents: number; accountsCount: number }>();
  for (const r of rows) {
    const cur = byDate.get(r.snapshot_date) ?? { totalCents: 0, accountsCount: 0 };
    cur.totalCents += r.balance_cents;
    cur.accountsCount += 1;
    byDate.set(r.snapshot_date, cur);
  }

  return Array.from(byDate.entries())
    .map(([date, { totalCents, accountsCount }]) => ({
      date,
      totalCents,
      accountsCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
