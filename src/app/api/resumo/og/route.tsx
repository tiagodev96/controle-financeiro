import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import { calculateMonthStats, topCategoriesThisMonth } from '@/lib/finance/dashboard-stats';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { listDebtsForHousehold } from '@/lib/finance/debts';
import { projectMonthForFuture } from '@/lib/finance/month-projection';
import type { Currency } from '@/components/finance/num';

// Node runtime (default). Mover pra edge depois se latência incomodar —
// volume é ~2 calls/mês, confiabilidade > latência.

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

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

function parseMes(raw: string | null, now: Date): { targetDate: Date; isPast: boolean; isFuture: boolean } {
  if (!raw) return { targetDate: now, isPast: false, isFuture: false };
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return { targetDate: now, isPast: false, isFuture: false };
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(y) || m < 1 || m > 12) {
    return { targetDate: now, isPast: false, isFuture: false };
  }
  const currentIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthIso = `${y}-${String(m).padStart(2, '0')}`;
  if (monthIso === currentIso) {
    return { targetDate: now, isPast: false, isFuture: false };
  }
  const targetDate = new Date(y, m, 0);
  return { targetDate, isPast: monthIso < currentIso, isFuture: monthIso > currentIso };
}

function parseMoeda(raw: string | null): Currency {
  if (raw === 'BRL' || raw === 'brl') return 'BRL';
  return 'EUR';
}

const SYMBOL = { EUR: '€', BRL: 'R$' } as const;

function formatMoney(cents: number, currency: Currency): string {
  const abs = Math.abs(cents) / 100;
  const formatted = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cents < 0 ? '−' : ''}${SYMBOL[currency]} ${formatted}`;
}

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
  const { targetDate, isPast, isFuture } = parseMes(url.searchParams.get('mes'), now);
  const moeda = parseMoeda(url.searchParams.get('moeda'));

  const supabase = await getServerSupabase();
  const session = await getSession();
  const { start, end } = monthBounds(targetDate);

  const [accountsAll, { open: openDebts }, topCatsRealRes, paidIncomeRes] = await Promise.all([
    listAllAccountsForHousehold(supabase, session.householdId),
    listDebtsForHousehold(supabase, session.householdId),
    topCategoriesThisMonth(supabase, session.householdId, moeda, 4, targetDate),
    supabase
      .from('transactions')
      .select('amount_cents')
      .eq('household_id', session.householdId)
      .eq('currency', moeda)
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
  const balanceCents = balanceByCurrency[moeda];

  const stats = await calculateMonthStats(
    supabase,
    session.householdId,
    moeda,
    balanceCents,
    targetDate,
  );

  const projection = isFuture
    ? await projectMonthForFuture({
        supabase,
        householdId: session.householdId,
        currency: moeda,
        balanceCents,
        targetDate,
        topCategoriesLimit: 4,
      })
    : null;

  const entradasMesCents = (paidIncomeRes.data ?? []).reduce((s, r) => s + r.amount_cents, 0);

  const hasData =
    accounts.length > 0 ||
    openDebts.length > 0 ||
    topCatsRealRes.length > 0 ||
    stats.paid.totalCents > 0 ||
    stats.pending.totalCents > 0 ||
    (projection !== null && projection.expenseProjectedCents > 0);

  if (!hasData) {
    return new Response(null, { status: 204 });
  }

  const heroValue = isFuture
    ? projection!.sobraProjetadaCents
    : isPast
      ? entradasMesCents - stats.paid.totalCents
      : stats.sobraPrevistaCents;
  const heroLabel = isFuture
    ? 'Sobra projetada'
    : isPast
      ? 'Sobra do mês'
      : 'Saldo previsto fim do mês';

  const entradasDisplay = isFuture ? projection!.incomeProjectedCents : entradasMesCents;
  const despesasDisplay = isFuture
    ? projection!.expenseProjectedCents
    : stats.paid.totalCents + stats.pending.totalCents;
  const topCatsDisplay = (isFuture ? projection!.topCategoriesProjected : topCatsRealRes).slice(0, 4);

  const monthTitle = `${MONTHS_PT[targetDate.getMonth()]} · ${targetDate.getFullYear()}`;
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

        {/* Dívidas abertas */}
        {openDebts.length > 0 && (
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
              dívidas em aberto
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
              {openDebts.slice(0, 4).map((d, idx) => (
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
                  <span style={{ fontSize: 26, color: COLORS.fg2 }}>{d.title}</span>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: COLORS.fg1,
                      fontFamily: 'JetBrainsMono',
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {formatMoney(d.remaining_amount_cents, d.currency)}
                  </span>
                </div>
              ))}
              {openDebts.length > 4 && (
                <div
                  style={{
                    display: 'flex',
                    padding: '12px 22px',
                    borderTop: `1px solid ${COLORS.border}`,
                  }}
                >
                  <span style={{ fontSize: 20, color: COLORS.fg4, fontFamily: 'JetBrainsMono' }}>
                    + {openDebts.length - 4}{' '}
                    {openDebts.length - 4 === 1 ? 'outra dívida' : 'outras dívidas'}
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

function monthBounds(d: Date): { start: string; end: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    start: new Date(y, m, 1).toISOString().slice(0, 10),
    end: new Date(y, m + 1, 1).toISOString().slice(0, 10),
  };
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
