import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import { calculateCrossCurrencyMonthStats } from '@/lib/finance/cross-currency-stats';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { listDebtsForHousehold, debtsClosedInMonth } from '@/lib/finance/debts';
import { projectMonth } from '@/lib/finance/month-projection';
import { convertCents, getRateMapSafe, type RateMap } from '@/lib/fx';
import { monthEyebrow, parseMonthParam, parseMoedaParam } from '@/lib/dates';
import { formatCents as formatMoney } from '@/lib/money/format';
import type { Currency } from '@/components/finance/num';

// Node runtime (default). Mover pra edge depois se latência incomodar —
// volume é ~2 calls/mês, confiabilidade > latência.

const COLORS = {
  bg: '#1a1416',
  surface: '#221b1e',
  border: '#3a2d31',
  fg1: '#f0e9e6',
  fg2: '#c5b9b3',
  fg3: '#9a8a82',
  fg4: '#6e6056',
  brand: '#8a2c3c',
  brandQuiet: '#d27089',
  positive: '#7ea177',
  negative: '#d27089',
} as const;

function dayMonthYear(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export async function GET(request: Request) {
  try {
    await getSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response('Unauthorized', { status: 401 });
    }
    throw err;
  }

  const url = new URL(request.url);
  const now = new Date();
  const { targetDate, isPast, isFuture } = parseMonthParam(url.searchParams.get('mes'), now);
  const moeda: Currency = parseMoedaParam(url.searchParams.get('moeda'), 'EUR');

  const supabase = await getServerSupabase();
  const session = await getSession();

  const [accountsAll, { open: openDebts, closed: closedDebts }] = await Promise.all([
    listAllAccountsForHousehold(supabase, session.householdId),
    listDebtsForHousehold(supabase, session.householdId),
  ]);

  const debtsToShow = [
    ...openDebts.map((d) => ({ debt: d, isClosed: false })),
    ...debtsClosedInMonth(closedDebts, targetDate).map((d) => ({ debt: d, isClosed: true })),
  ];

  const fxRateMap: RateMap | null = await getRateMapSafe({
    supabase,
    serviceSupabase: getServiceRoleSupabase(),
    when: now,
  });

  const accounts = accountsAll.filter((a) => !a.is_archived);
  // Soma cross-currency em `moeda`.
  let accountsTotalInMoeda = 0;
  for (const a of accounts) {
    if (a.currency === moeda) {
      accountsTotalInMoeda += a.balance_cents;
    } else if (fxRateMap) {
      const rate = moeda === 'EUR' ? fxRateMap.BRL_EUR : fxRateMap.EUR_BRL;
      accountsTotalInMoeda += convertCents(a.balance_cents, rate);
    }
  }

  const stats = await calculateCrossCurrencyMonthStats({
    supabase,
    householdId: session.householdId,
    targetCurrency: moeda,
    fxRateMap,
    accountsTotalInTargetCents: accountsTotalInMoeda,
    targetDate,
    topCategoriesLimit: 4,
  });

  const projection = isFuture
    ? await projectMonth({
        supabase,
        householdId: session.householdId,
        targetCurrency: moeda,
        fxRateMap,
        accountsTotalInTargetCents: accountsTotalInMoeda,
        targetDate,
        now,
        topCategoriesLimit: 4,
      })
    : null;

  const hasData =
    accounts.length > 0 ||
    debtsToShow.length > 0 ||
    stats.topCategories.length > 0 ||
    stats.paidExpenseCents > 0 ||
    stats.pendingExpenseCents > 0 ||
    (projection !== null && projection.expenseProjectedCents > 0);

  if (!hasData) {
    return new Response(null, { status: 204 });
  }

  const heroValue = isFuture
    ? projection!.sobraProjetadaCents
    : isPast
      ? stats.paidIncomeCents - stats.paidExpenseCents
      : stats.saldoPrevistoFimDoMesCents;
  const heroLabel = isFuture
    ? 'Sobra projetada'
    : isPast
      ? 'Sobra do mês'
      : 'Saldo previsto fim do mês';

  const entradasDisplay = isFuture ? projection!.incomeProjectedCents : stats.paidIncomeCents;
  const despesasDisplay = isFuture
    ? projection!.expenseProjectedCents
    : stats.paidExpenseCents + stats.pendingExpenseCents;
  const topCatsDisplay = (isFuture ? projection!.topCategoriesProjected : stats.topCategories).slice(
    0,
    4,
  );

  const monthTitle = monthEyebrow(targetDate);
  const contextLabel = isFuture ? 'projeção' : isPast ? 'fechado' : 'mês atual';

  const fontsDir = join(process.cwd(), 'public/fonts/og');
  const [geistRegular, geistBold, mono] = await Promise.all([
    readFile(join(fontsDir, 'geist-400.woff')),
    readFile(join(fontsDir, 'geist-700.woff')),
    readFile(join(fontsDir, 'jbmono-400.woff')),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
          color: COLORS.fg1,
          padding: '56px 56px',
          fontFamily: 'Geist',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p
            style={{
              fontSize: 22,
              color: COLORS.fg3,
              margin: 0,
              fontFamily: 'JetBrainsMono',
              textTransform: 'uppercase',
              letterSpacing: 4,
            }}
          >
            resumo · {moeda} · {contextLabel}
          </p>
          <h1 style={{ fontSize: 60, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
            {monthTitle}
          </h1>
        </div>

        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 36 }}>
          <p style={{ fontSize: 24, color: COLORS.fg3, margin: 0 }}>{heroLabel}</p>
          <p
            style={{
              fontSize: 108,
              fontWeight: 700,
              margin: 0,
              color: heroValue < 0 ? COLORS.negative : COLORS.fg1,
              fontFeatureSettings: '"tnum"',
              fontFamily: 'JetBrainsMono',
              lineHeight: 1,
            }}
          >
            {formatMoney(heroValue, moeda)}
          </p>
        </div>

        {/* Movimentação — 2 tiles */}
        <div style={{ display: 'flex', gap: 16, marginTop: 36 }}>
          <Tile
            label={isFuture ? 'Entradas previstas' : 'Entradas'}
            value={formatMoney(entradasDisplay, moeda)}
            tone="positive"
          />
          <Tile
            label={isFuture ? 'Despesas previstas' : 'Despesas'}
            value={formatMoney(despesasDisplay, moeda)}
            tone="negative"
          />
        </div>

        {/* Top categorias */}
        {topCatsDisplay.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 32, gap: 10 }}>
            <p
              style={{
                fontSize: 20,
                color: COLORS.fg3,
                margin: 0,
                fontFamily: 'JetBrainsMono',
                textTransform: 'uppercase',
                letterSpacing: 4,
              }}
            >
              top categorias
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
              }}
            >
              {topCatsDisplay.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 22px',
                    borderTop: idx === 0 ? 'none' : `1px solid ${COLORS.border}`,
                  }}
                >
                  <span style={{ fontSize: 26, color: COLORS.fg2 }}>{c.name}</span>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: COLORS.fg1,
                      fontFamily: 'JetBrainsMono',
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {formatMoney(c.totalCents, moeda)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dívidas (abertas + quitadas no mês) */}
        {debtsToShow.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24, gap: 10 }}>
            <p
              style={{
                fontSize: 20,
                color: COLORS.fg3,
                margin: 0,
                fontFamily: 'JetBrainsMono',
                textTransform: 'uppercase',
                letterSpacing: 4,
              }}
            >
              dívidas
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
              }}
            >
              {debtsToShow.slice(0, 4).map(({ debt: d, isClosed }, idx) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 22px',
                    borderTop: idx === 0 ? 'none' : `1px solid ${COLORS.border}`,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 26, color: COLORS.fg2 }}>{d.title}</span>
                    {isClosed && (
                      <span
                        style={{
                          fontSize: 16,
                          color: COLORS.fg4,
                          fontFamily: 'JetBrainsMono',
                          textTransform: 'uppercase',
                          letterSpacing: 2,
                        }}
                      >
                        quitada
                      </span>
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: isClosed ? COLORS.fg3 : COLORS.fg1,
                      fontFamily: 'JetBrainsMono',
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {formatMoney(d.remaining_amount_cents, d.currency)}
                  </span>
                </div>
              ))}
              {debtsToShow.length > 4 && (
                <div
                  style={{
                    display: 'flex',
                    padding: '12px 22px',
                    borderTop: `1px solid ${COLORS.border}`,
                  }}
                >
                  <span style={{ fontSize: 20, color: COLORS.fg4, fontFamily: 'JetBrainsMono' }}>
                    + {debtsToShow.length - 4}{' '}
                    {debtsToShow.length - 4 === 1 ? 'outra dívida' : 'outras dívidas'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 24,
            fontFamily: 'JetBrainsMono',
            fontSize: 18,
            color: COLORS.fg4,
          }}
        >
          <span>controle financeiro</span>
          <span>gerado em {dayMonthYear(now)}</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: 'Geist', data: geistRegular, weight: 400 },
        { name: 'Geist', data: geistBold, weight: 700 },
        { name: 'JetBrainsMono', data: mono, weight: 400 },
      ],
    },
  );
}


function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
}) {
  const color = tone === 'positive' ? COLORS.positive : COLORS.negative;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: '20px 22px',
        gap: 8,
      }}
    >
      <p
        style={{
          fontSize: 18,
          color: COLORS.fg4,
          margin: 0,
          fontFamily: 'JetBrainsMono',
          textTransform: 'uppercase',
          letterSpacing: 3,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 42,
          fontWeight: 700,
          margin: 0,
          color,
          fontFamily: 'JetBrainsMono',
          fontFeatureSettings: '"tnum"',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}
