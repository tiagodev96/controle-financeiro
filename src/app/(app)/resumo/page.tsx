import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { HeroNumber, Num, type Currency } from '@/components/finance/num';
import { SharePngActions } from '@/components/finance/share-png-actions';
import { MonthPicker } from '@/components/finance/dashboard-month-picker';
import { ResumoCurrencyToggle } from '@/components/finance/resumo-currency-toggle';
import { calculateMonthStats, topCategoriesThisMonth } from '@/lib/finance/dashboard-stats';
import { projectMonthForFuture, type MonthProjection } from '@/lib/finance/month-projection';
import { getBalanceByAccountOn } from '@/lib/finance/balance-history';
import { listDebtsForHousehold, sumDebtPaymentsThisMonth } from '@/lib/finance/debts';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { buildMonthSummaryText, type FxRateMap } from '@/lib/finance/month-summary';
import { convertCents, getRateMap, FxUnavailableError } from '@/lib/fx';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function monthRange(date: Date): { start: string; end: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
}

function monthEyebrow(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]} · ${d.getFullYear()}`;
}

type SearchParams = Promise<{ mes?: string; moeda?: string }>;

function parseMonthParam(
  raw: string | undefined,
  now: Date,
): { targetDate: Date; monthIso: string; isPast: boolean; isFuture: boolean } {
  const currentIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const match = raw && /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  const monthIso = `${y}-${String(m).padStart(2, '0')}`;
  if (monthIso === currentIso) {
    return { targetDate: now, monthIso: currentIso, isPast: false, isFuture: false };
  }
  // Último dia do mês alvo — preserva semântica de "fim do mês" pra stats.
  const targetDate = new Date(y, m, 0);
  return {
    targetDate,
    monthIso,
    isPast: monthIso < currentIso,
    isFuture: monthIso > currentIso,
  };
}

function parseMoedaParam(raw: string | undefined, fallback: Currency): Currency {
  if (raw === 'EUR' || raw === 'eur') return 'EUR';
  if (raw === 'BRL' || raw === 'brl') return 'BRL';
  return fallback;
}

export default async function ResumoPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const now = new Date();
  const params = await searchParams;
  const { targetDate, monthIso, isPast, isFuture } = parseMonthParam(params.mes, now);
  const currentMonthIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const primary: Currency = parseMoedaParam(params.moeda, 'EUR');

  const { start, end } = monthRange(targetDate);

  const [accountsAll, { open: openDebts }, debtPaymentsByDebtId, topCats, paidIncomeRes] =
    await Promise.all([
      listAllAccountsForHousehold(supabase, session.householdId),
      listDebtsForHousehold(supabase, session.householdId),
      sumDebtPaymentsThisMonth(supabase, session.householdId, targetDate),
      topCategoriesThisMonth(supabase, session.householdId, primary, 3, targetDate),
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

  let fxRateMap: FxRateMap | null = null;
  try {
    const map = await getRateMap({
      supabase,
      serviceSupabase: getServiceRoleSupabase(),
      when: now,
    });
    fxRateMap = { EUR_BRL: map.EUR_BRL, BRL_EUR: map.BRL_EUR };
  } catch (err) {
    if (!(err instanceof FxUnavailableError)) throw err;
  }

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
    targetDate,
  );

  const projection: MonthProjection | null = isFuture
    ? await projectMonthForFuture({
        supabase,
        householdId: session.householdId,
        currency: primary,
        balanceCents,
        targetDate,
        topCategoriesLimit: 3,
      })
    : null;

  const entradasMesCents = (paidIncomeRes.data ?? []).reduce(
    (sum, r) => sum + r.amount_cents,
    0,
  );

  const hasData =
    accounts.length > 0 ||
    openDebts.length > 0 ||
    topCats.length > 0 ||
    stats.paid.totalCents > 0 ||
    stats.pending.totalCents > 0 ||
    (projection !== null && projection.expenseProjectedCents > 0);

  const hasBothCurrencies =
    accounts.some((a) => a.currency === 'EUR') &&
    accounts.some((a) => a.currency === 'BRL');

  const totalConvertedDisplay = (() => {
    if (!fxRateMap || !hasBothCurrencies) return null;
    let eurCents = 0;
    let brlCents = 0;
    for (const a of accounts) {
      if (a.currency === 'EUR') {
        eurCents += a.balance_cents;
        brlCents += convertCents(a.balance_cents, fxRateMap.EUR_BRL);
      } else {
        brlCents += a.balance_cents;
        eurCents += convertCents(a.balance_cents, fxRateMap.BRL_EUR);
      }
    }
    return { eurCents, brlCents };
  })();

  const saldoPrevistoFimDoMesCents = stats.sobraPrevistaCents;
  const sobraPrevistaCents = saldoPrevistoFimDoMesCents - balanceCents;

  const summaryText = buildMonthSummaryText({
    now: targetDate,
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
    fxRateMap,
  });

  const monthFlowNetCents = entradasMesCents - stats.paid.totalCents;

  // Saldo histórico: pra mês passado, busca snapshot mais recente <= fim do
  // mês. Se TODAS as accounts da currency primária têm snapshot, usa como
  // hero ("Saldo no fim do mês"); senão cai pro fluxo ("Sobra do mês").
  const accountsPrimary = accounts.filter((a) => a.currency === primary);
  const historicalLookup = isPast
    ? await getBalanceByAccountOn(
        supabase,
        accountsPrimary.map((a) => ({ id: a.id, balance_cents: a.balance_cents })),
        targetDate,
      )
    : null;
  const historicalBalanceCents = historicalLookup
    ? Object.values(historicalLookup).reduce((sum, l) => sum + l.cents, 0)
    : 0;
  const historicalAllFromSnapshot = historicalLookup
    ? accountsPrimary.length > 0 &&
      accountsPrimary.every((a) => historicalLookup[a.id]?.source === 'snapshot')
    : false;

  const heroLabel = isFuture
    ? `Sobra projetada de ${monthEyebrow(targetDate)}`
    : isPast && historicalAllFromSnapshot
      ? `Saldo em ${monthEyebrow(targetDate)}`
      : isPast
        ? `Sobra de ${monthEyebrow(targetDate)}`
        : 'Saldo previsto fim do mês';
  const heroValue = isFuture
    ? projection!.sobraProjetadaCents
    : isPast && historicalAllFromSnapshot
      ? historicalBalanceCents
      : isPast
        ? monthFlowNetCents
        : saldoPrevistoFimDoMesCents;

  const displayEntradas = isFuture ? projection!.incomeProjectedCents : entradasMesCents;
  const displayDespesas = isFuture
    ? projection!.expenseProjectedCents
    : stats.paid.totalCents + stats.pending.totalCents;
  const displayTopCats = isFuture
    ? projection!.topCategoriesProjected
    : topCats.map((c) => ({ id: c.id, name: c.name, totalCents: c.totalCents }));

  const eyebrow = isFuture
    ? `projetando ${monthEyebrow(targetDate)}`
    : isPast
      ? `visualizando ${monthEyebrow(targetDate)}`
      : monthEyebrow(now);

  return (
    <section className="space-y-6 cf-fade-up">
      <AppTopBar
        eyebrow={eyebrow}
        title="Resumo do mês"
        trailing={
          <div className="flex items-center gap-2">
            <ResumoCurrencyToggle
              current={primary}
              preservedQuery={monthIso !== currentMonthIso ? { mes: monthIso } : {}}
            />
            <MonthPicker
              value={monthIso}
              currentMonth={currentMonthIso}
              basePath="/resumo"
              preservedQuery={primary !== 'EUR' ? { moeda: primary.toLowerCase() } : {}}
            />
          </div>
        }
      />

      {!hasData ? (
        <EmptyHero isPast={isPast || isFuture} />
      ) : (
        <>
          <section className="space-y-4 rounded-md border border-border-soft bg-bg-surface p-5">
            <div className="space-y-1">
              <p className="text-[13px] text-fg3">{heroLabel}</p>
              <HeroNumber cents={heroValue} currency={primary} />
            </div>
            {isFuture && (
              <p className="text-[11px] text-fg4">
                projeção: recorrentes ativas + parcelas previstas + saldo atual
              </p>
            )}
            {isPast && historicalAllFromSnapshot && (
              <p className="text-[11px] text-fg4">
                saldo do snapshot mais recente do mês
              </p>
            )}
            {isPast && !historicalAllFromSnapshot && (
              <p className="text-[11px] text-fg4">
                estimado a partir do fluxo — snapshot ainda não capturado pra essa data
              </p>
            )}
          </section>

          <section className="space-y-2">
            <p className="eyebrow px-1">
              {isFuture ? 'Movimentação projetada' : 'Movimentação do mês'}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile
                label={isFuture ? 'Entradas previstas' : 'Entradas'}
                cents={displayEntradas}
                currency={primary}
                tone="positive"
              />
              <Tile
                label={isFuture ? 'Despesas previstas' : 'Despesas'}
                cents={displayDespesas}
                currency={primary}
                tone="negative"
              />
            </div>
            {isFuture ? (
              <p className="px-1 text-[12px] text-fg4">
                Recorrentes projetadas{' '}
                <Num
                  cents={projection!.recurringPendingExpenseCents}
                  currency={primary}
                  className="text-fg2"
                />{' '}
                · parcelas a vencer{' '}
                <Num cents={stats.pending.totalCents} currency={primary} className="text-fg2" />
              </p>
            ) : isPast ? (
              <p className="px-1 text-[12px] text-fg4">
                Já pago{' '}
                <Num cents={stats.paid.totalCents} currency={primary} className="text-fg2" />
                {stats.pending.totalCents > 0 && (
                  <>
                    {' '}·{' '}esquecido{' '}
                    <Num
                      cents={stats.pending.totalCents}
                      currency={primary}
                      className="text-money-negative"
                    />{' '}
                    ({stats.pending.count} {stats.pending.count === 1 ? 'item' : 'itens'} sem
                    marcar pago)
                  </>
                )}
              </p>
            ) : (
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
            )}
          </section>

          {displayTopCats.length > 0 && (
            <section className="space-y-2">
              <p className="eyebrow px-1">
                {isFuture ? 'Top categorias previstas' : 'Top categorias'}
              </p>
              <ul className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3 py-1">
                {displayTopCats.map((c) => (
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
                {totalConvertedDisplay && (
                  <li className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-fg2">Total convertido</span>
                    <span className="flex items-baseline gap-2">
                      <Num
                        cents={totalConvertedDisplay.eurCents}
                        currency="EUR"
                        className="font-semibold text-fg1"
                      />
                      <Num
                        cents={totalConvertedDisplay.brlCents}
                        currency="BRL"
                        className="text-[12px] text-fg3"
                      />
                    </span>
                  </li>
                )}
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-fg2">{a.name}</span>
                    <Num cents={a.balance_cents} currency={a.currency} className="font-semibold text-fg1" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <SharePngActions text={summaryText} monthIso={monthIso} moeda={primary} />
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

function EmptyHero({ isPast }: { isPast: boolean }) {
  if (isPast) {
    return (
      <div className="rounded-md border border-border-soft bg-bg-surface p-8 text-center text-sm text-fg3">
        Sem dados pro mês selecionado.
      </div>
    );
  }
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
