import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { HeroNumber, Num, type Currency } from '@/components/finance/num';
import { ShareCopyActions } from '@/components/finance/share-copy-actions';
import { calculateMonthStats, topCategoriesThisMonth } from '@/lib/finance/dashboard-stats';
import { listDebtsForHousehold, sumDebtPaymentsThisMonth } from '@/lib/finance/debts';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { buildMonthSummaryText } from '@/lib/finance/month-summary';

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function monthRange(now: Date): { start: string; end: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

export default async function ResumoPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const now = new Date();
  const primary: Currency = 'EUR';

  const { start, end } = monthRange(now);

  const [accountsAll, { open: openDebts }, debtPaymentsByDebtId, topCats, paidIncomeRes] =
    await Promise.all([
      listAllAccountsForHousehold(supabase, session.householdId),
      listDebtsForHousehold(supabase, session.householdId),
      sumDebtPaymentsThisMonth(supabase, session.householdId, now),
      topCategoriesThisMonth(supabase, session.householdId, primary, 3, now),
      supabase
        .from('transactions')
        .select('amount_cents')
        .eq('household_id', session.householdId)
        .eq('currency', primary)
        .eq('direction', 'income')
        .eq('status', 'paid')
        .gte('paid_on', start)
        .lt('paid_on', end),
    ]);

  const accounts = accountsAll.filter((a) => !a.is_archived);
  const balanceByCurrency = accounts.reduce<Record<Currency, number>>(
    (acc, a) => {
      acc[a.currency] = (acc[a.currency] ?? 0) + a.balance_cents;
      return acc;
    },
    { BRL: 0, EUR: 0 },
  );
  const balanceCents = balanceByCurrency[primary];

  const stats = await calculateMonthStats(
    supabase,
    session.householdId,
    primary,
    balanceCents,
    now,
  );

  const entradasMesCents = (paidIncomeRes.data ?? []).reduce(
    (sum, r) => sum + r.amount_cents,
    0,
  );

  const hasData =
    accounts.length > 0 ||
    openDebts.length > 0 ||
    topCats.length > 0 ||
    stats.paid.totalCents > 0 ||
    stats.pending.totalCents > 0;

  const saldoPrevistoFimDoMesCents = stats.sobraPrevistaCents;
  const sobraPrevistaCents = saldoPrevistoFimDoMesCents - balanceCents;

  const summaryText = buildMonthSummaryText({
    now,
    primaryCurrency: primary,
    saldoPrevistoFimDoMesCents,
    sobraPrevistaCents,
    entradasMesCents,
    despesasPaidCents: stats.paid.totalCents,
    despesasPendingCents: stats.pending.totalCents,
    overdueCents: stats.overdue.totalCents,
    overdueCount: stats.overdue.count,
    topCategories: topCats.map((c) => ({ name: c.name, totalCents: c.totalCents })),
    openDebts: openDebts.map((d) => ({
      id: d.id,
      title: d.title,
      currency: d.currency,
      remainingCents: d.remaining_amount_cents,
    })),
    debtPaymentsByDebtId,
    accounts: accounts.map((a) => ({
      name: a.name,
      currency: a.currency,
      balanceCents: a.balance_cents,
    })),
  });

  return (
    <section className="space-y-6 cf-fade-up">
      <AppTopBar
        eyebrow={`${MONTHS_PT[now.getMonth()]} · ${now.getFullYear()}`}
        title="Resumo do mês"
      />

      {!hasData ? (
        <EmptyHero />
      ) : (
        <>
          <section className="space-y-4 rounded-md border border-border-soft bg-bg-surface p-5">
            <div className="space-y-1">
              <p className="text-[13px] text-fg3">Saldo previsto fim do mês</p>
              <HeroNumber cents={saldoPrevistoFimDoMesCents} currency={primary} />
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-fg3">
              <span>Sobra prevista:</span>
              <Num
                cents={sobraPrevistaCents}
                currency={primary}
                sign={sobraPrevistaCents >= 0}
                className={
                  sobraPrevistaCents >= 0
                    ? 'text-[15px] font-semibold text-money-positive'
                    : 'text-[15px] font-semibold text-money-negative'
                }
              />
            </div>
          </section>

          <section className="space-y-2">
            <p className="eyebrow px-1">Movimentação do mês</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile label="Entradas" cents={entradasMesCents} currency={primary} tone="positive" />
              <Tile
                label="Despesas"
                cents={stats.paid.totalCents + stats.pending.totalCents}
                currency={primary}
                tone="negative"
              />
            </div>
            <p className="px-1 text-[12px] text-fg4">
              Já pago{' '}
              <Num cents={stats.paid.totalCents} currency={primary} className="text-fg2" /> ·
              {' '}pendente{' '}
              <Num cents={stats.pending.totalCents} currency={primary} className="text-fg2" />
              {stats.overdue.count > 0 && (
                <>
                  {' '}·{' '}em atraso{' '}
                  <Num cents={stats.overdue.totalCents} currency={primary} className="text-money-negative" />{' '}
                  ({stats.overdue.count})
                </>
              )}
            </p>
          </section>

          {topCats.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">Top categorias</p>
              <ul className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3 py-1">
                {topCats.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-fg2">{c.name}</span>
                    <Num cents={c.totalCents} currency={primary} className="font-semibold text-fg1" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {openDebts.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">Dívidas abertas</p>
              <ul className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3 py-1">
                {openDebts.map((d) => {
                  const paidThis = debtPaymentsByDebtId[d.id] ?? 0;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-fg2">{d.title}</span>
                        {paidThis > 0 && (
                          <span className="mono text-[10px] text-fg4">
                            pago este mês: <Num cents={paidThis} currency={d.currency} className="text-fg3" />
                          </span>
                        )}
                      </div>
                      <Num
                        cents={d.remaining_amount_cents}
                        currency={d.currency}
                        className="shrink-0 font-semibold text-fg1"
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {accounts.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">Contas</p>
              <ul className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3 py-1">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-fg2">{a.name}</span>
                    <Num cents={a.balance_cents} currency={a.currency} className="font-semibold text-fg1" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ShareCopyActions text={summaryText} />
        </>
      )}
    </section>
  );
}

function Tile({
  label,
  cents,
  currency,
  tone,
}: {
  label: string;
  cents: number;
  currency: Currency;
  tone: 'positive' | 'negative';
}) {
  const color = tone === 'positive' ? 'text-money-positive' : 'text-money-negative';
  return (
    <div className="rounded-md border border-border-soft bg-bg-surface p-3.5">
      <p className="mono text-[10px] uppercase tracking-wider text-fg4">{label}</p>
      <Num cents={cents} currency={currency} className={`mt-1.5 block text-[20px] font-semibold ${color}`} />
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-border-soft bg-bg-surface p-8 text-center">
      <div className="space-y-2">
        <h2>Sem dados pra resumir.</h2>
        <p className="text-sm text-fg3">
          Lance a primeira despesa pra começar a fechar o mês.
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
