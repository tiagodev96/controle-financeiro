import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import { calculateMonthStats } from '@/lib/finance/dashboard-stats';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { projectMonthForFuture } from '@/lib/finance/month-projection';
import type { Currency } from '@/components/finance/num';

// Node runtime (default) — Supabase SSR + cookies funciona sem ajuste.
// Mover pra edge depois se latência incomodar (volume é ~2 calls/mês, então
// confiabilidade > latência).

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

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

  const accountsAll = await listAllAccountsForHousehold(supabase, session.householdId);
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
        topCategoriesLimit: 3,
      })
    : null;

  const hasData =
    accounts.length > 0 ||
    stats.paid.totalCents > 0 ||
    stats.pending.totalCents > 0 ||
    (projection !== null && projection.expenseProjectedCents > 0);

  if (!hasData) {
    return new Response(null, { status: 204 });
  }

  const heroValue = isFuture
    ? projection!.sobraProjetadaCents
    : isPast
      ? stats.incomePaid.totalCents - stats.paid.totalCents
      : stats.sobraPrevistaCents;
  const heroLabel = isFuture
    ? 'Sobra projetada'
    : isPast
      ? 'Sobra do mês'
      : 'Saldo previsto fim do mês';
  const monthTitle = `${MONTHS_PT[targetDate.getMonth()]} · ${targetDate.getFullYear()}`;

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
          background: '#1a1416',
          color: '#f0e9e6',
          padding: '64px 56px',
          fontFamily: 'Geist',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 28, color: '#9a8a82', margin: 0, fontFamily: 'JetBrainsMono', textTransform: 'uppercase', letterSpacing: 4 }}>
            resumo · {moeda}
          </p>
          <h1 style={{ fontSize: 64, fontWeight: 700, margin: 0 }}>{monthTitle}</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 80 }}>
          <p style={{ fontSize: 30, color: '#9a8a82', margin: 0 }}>{heroLabel}</p>
          <p
            style={{
              fontSize: 128,
              fontWeight: 700,
              margin: 0,
              color: heroValue < 0 ? '#d27089' : '#f0e9e6',
              fontFeatureSettings: '"tnum"',
              fontFamily: 'JetBrainsMono',
            }}
          >
            {formatMoney(heroValue, moeda)}
          </p>
        </div>

        <div style={{ flex: 1 }} />

        <p style={{ fontSize: 22, color: '#6e6056', margin: 0, fontFamily: 'JetBrainsMono' }}>
          gerado em {now.getDate().toString().padStart(2, '0')}/{(now.getMonth() + 1).toString().padStart(2, '0')}/{now.getFullYear()}
        </p>
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
