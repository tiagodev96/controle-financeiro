import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { StatCard } from '@/components/finance/stat-card';
import { TxnRow } from '@/components/finance/txn-row';
import { formatCentsToBRL } from '@/lib/money/format';

const CURRENCY_SYMBOL = { BRL: 'R$', EUR: '€' } as const;

type Currency = 'BRL' | 'EUR';
type Direction = 'expense' | 'income';
type Status = 'pending' | 'paid';

type TxnRowData = {
  id: string;
  description: string;
  amount_cents: number;
  currency: Currency;
  direction: Direction;
  status: Status;
  occurred_on: string;
  categories: { name: string } | null;
};

export default async function DashboardPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const [accountsRes, txnsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, currency, balance_cents')
      .eq('is_archived', false),
    supabase
      .from('transactions')
      .select(
        'id, description, amount_cents, currency, direction, status, occurred_on, categories(name)',
      )
      .eq('household_id', session.householdId)
      .order('occurred_on', { ascending: false })
      .limit(10),
  ]);

  const accounts = accountsRes.data ?? [];
  const balanceByCurrency = accounts.reduce<Record<Currency, number>>(
    (acc, a) => {
      const cur = a.currency as Currency;
      acc[cur] = (acc[cur] ?? 0) + a.balance_cents;
      return acc;
    },
    { BRL: 0, EUR: 0 },
  );

  const txns = (txnsRes.data ?? []) as unknown as TxnRowData[];
  const grouped = groupByDay(txns);
  const hasData = txns.length > 0 || accounts.some((a) => a.balance_cents !== 0);

  return (
    <section className="space-y-7">
      {!hasData ? (
        <EmptyHero />
      ) : (
        <div className="grid gap-3">
          {(['EUR', 'BRL'] as const)
            .filter(
              (cur) =>
                balanceByCurrency[cur] !== 0 ||
                accounts.some((a) => a.currency === cur),
            )
            .map((cur, idx) => (
              <StatCard
                key={cur}
                label={idx === 0 ? 'Saldo atual' : `Saldo atual ${cur}`}
                size={idx === 0 ? 'hero' : 'stat'}
              >
                <span>
                  {CURRENCY_SYMBOL[cur]} {formatCentsToBRL(balanceByCurrency[cur])}
                </span>
              </StatCard>
            ))}
        </div>
      )}

      {txns.length > 0 && (
        <section className="space-y-4">
          {grouped.map(({ label, rows }) => (
            <div key={label} className="space-y-1">
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
                    status={t.status === 'paid' ? 'paid' : 'pending'}
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

function EmptyHero() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-border-soft bg-bg-surface p-8 text-center">
      <div className="space-y-2">
        <h2>Sem transações ainda.</h2>
        <p className="text-sm text-fg3">
          O dashboard ganha vida quando há movimentação.
        </p>
      </div>
      <Link
        href="/lancar"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand px-5 py-2 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Lançar primeira despesa
      </Link>
    </div>
  );
}

function groupByDay(txns: TxnRowData[]): { label: string; rows: TxnRowData[] }[] {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  const groups = new Map<string, TxnRowData[]>();
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
