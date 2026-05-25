import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { TxnRow } from '@/components/finance/txn-row';
import { TransactionFilters } from '@/components/finance/transaction-filters';
import { MarkPaidButton } from '@/components/finance/mark-paid-button';
import { Num } from '@/components/finance/num';
import {
  listTransactionsForHousehold,
  type Status,
  type TxnListRow,
} from '@/lib/finance/transactions';

const MONTHS_PT_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number);
  return `${MONTHS_PT_SHORT[(m ?? 1) - 1]}/${y}`;
}

function lastNMonths(n: number): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { value, label: monthLabel(value) };
  });
}

function parseStatus(raw: string | undefined): Status | undefined {
  if (raw === 'pending' || raw === 'paid') return raw;
  return undefined;
}

function groupByDay(txns: TxnListRow[]): { label: string; rows: TxnListRow[] }[] {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  const groups = new Map<string, TxnListRow[]>();
  for (const t of txns) {
    const list = groups.get(t.occurred_on) ?? [];
    list.push(t);
    groups.set(t.occurred_on, list);
  }

  return Array.from(groups.entries()).map(([day, rows]) => {
    let label = day.slice(8, 10) + '/' + day.slice(5, 7);
    if (day === todayIso) label = 'Hoje';
    else if (day === yesterdayIso) label = 'Ontem';
    return { label, rows };
  });
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransacoesPage({ searchParams }: Props) {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const params = await searchParams;
  const monthOptions = lastNMonths(6);
  const defaultMonth = monthOptions[0]?.value ?? '';
  const status = parseStatus(typeof params.status === 'string' ? params.status : undefined);
  const accountId = typeof params.conta === 'string' && params.conta !== 'all' ? params.conta : undefined;
  const mesRaw = typeof params.mes === 'string' ? params.mes : defaultMonth;
  const monthIso = mesRaw === 'all' ? undefined : mesRaw;

  const [{ transactions: txns, total }, accountsRes] = await Promise.all([
    listTransactionsForHousehold(supabase, {
      householdId: session.householdId,
      status,
      accountId,
      monthIso,
    }),
    supabase
      .from('accounts')
      .select('id, name')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true }),
  ]);

  const accounts = (accountsRes.data ?? []).map((a) => ({ id: a.id, name: a.name }));

  let expenseCents = 0;
  let incomeCents = 0;
  for (const t of txns) {
    if (t.direction === 'expense') expenseCents += t.amount_cents;
    else incomeCents += t.amount_cents;
  }
  const grouped = groupByDay(txns);
  const eyebrow = `${total} ${total === 1 ? 'lançamento' : 'lançamentos'}`;

  return (
    <section className="space-y-5">
      <AppTopBar eyebrow={eyebrow} title="Transações" />

      <TransactionFilters accounts={accounts} monthOptions={monthOptions} />

      {txns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-soft bg-bg-surface px-4 py-3 text-sm">
          {expenseCents > 0 && (
            <span className="flex items-baseline gap-1.5">
              <span className="caption">despesa</span>
              <Num cents={-expenseCents} sign className="text-[14px] font-semibold text-money-negative" />
            </span>
          )}
          {incomeCents > 0 && (
            <span className="flex items-baseline gap-1.5">
              <span className="caption">entrada</span>
              <Num cents={incomeCents} sign className="text-[14px] font-semibold text-money-positive" />
            </span>
          )}
          {total > txns.length && (
            <span className="mono ml-auto text-[10px] text-fg4">
              mostrando {txns.length} de {total}
            </span>
          )}
        </div>
      )}

      {txns.length === 0 ? (
        total === 0 ? (
          <FreshEmpty />
        ) : (
          <FilterEmpty />
        )
      ) : (
        <section className="space-y-4">
          {grouped.map(({ label, rows }) => (
            <div key={label} className="space-y-1.5">
              <p className="eyebrow px-1">{label}</p>
              <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
                {rows.map((t) => (
                  <TxnRow
                    key={t.id}
                    description={t.description}
                    category={t.categories?.name ?? '—'}
                    amountCents={t.amount_cents}
                    currency={t.currency}
                    direction={t.direction}
                    status={t.status}
                    action={
                      t.status === 'pending' ? (
                        <MarkPaidButton transactionId={t.id} />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}

function FreshEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-border-soft bg-bg-surface p-8 text-center">
      <p className="text-fg3">Sem transações ainda.</p>
      <Link
        href="/lancar"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-fg-on-brand hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Lançar despesa
      </Link>
    </div>
  );
}

function FilterEmpty() {
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
      Sem transações pra esse filtro.
    </div>
  );
}
