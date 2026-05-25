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
    <section className="space-y-5">
      {!hasData ? (
        <EmptyHero />
      ) : (
        <div className="grid gap-3">
          {(['BRL', 'EUR'] as const)
            .filter((cur) => balanceByCurrency[cur] !== 0 || accounts.some((a) => a.currency === cur))
            .map((cur) => (
              <StatCard
                key={cur}
                label={`Saldo atual ${cur}`}
                size="lg"
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
              <p className="caption px-1">{label}</p>
              <div className="divide-y divide-border rounded-md border border-border bg-surface px-3">
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
    <div className="flex flex-col items-center gap-4 rounded-md border border-border bg-surface p-8 text-center">
      <div className="space-y-1">
        <h2>Comece pela primeira despesa.</h2>
        <p className="text-sm text-fg-muted">
          O dashboard ganha vida quando há movimentação.
        </p>
      </div>
      <Link
        href="/?sheet=lancar"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Lançar despesa
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
