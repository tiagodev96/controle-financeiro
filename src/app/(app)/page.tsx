import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { HeroNumber, Num, type Currency } from '@/components/finance/num';
import { CCY } from '@/components/finance/ccy';
import { TxnRow } from '@/components/finance/txn-row';

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

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function monthEyebrow(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]} · ${d.getFullYear()}`;
}

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
  const primaryCurrency: Currency = 'EUR';
  const secondaryCurrency: Currency = 'BRL';

  return (
    <section className="space-y-6">
      <AppTopBar eyebrow={monthEyebrow(new Date())} title="Dashboard" />

      {!hasData ? (
        <EmptyHero />
      ) : (
        <section className="space-y-3">
          <p className="text-[15px] text-fg3">Saldo atual</p>
          <HeroNumber cents={balanceByCurrency[primaryCurrency]} currency={primaryCurrency} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CCY code={primaryCurrency} />
            <Num cents={balanceByCurrency[primaryCurrency]} currency={primaryCurrency} className="text-[11px] text-fg3" />
            <span className="text-fg5">·</span>
            <CCY code={secondaryCurrency} />
            <Num cents={balanceByCurrency[secondaryCurrency]} currency={secondaryCurrency} className="text-[11px] text-fg3" />
          </div>
        </section>
      )}

      {txns.length > 0 && (
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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-fg-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-4" strokeWidth={1.6} aria-hidden />
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
