import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { generateRecurringForMonthCore } from '@/server/actions/recurring/generate-core';
import { getRate } from '@/lib/fx';

type CronDeps = {
  serviceSupabase: SupabaseClient<Database>;
};

export type RecurringCronSummary = {
  householdId: string;
  created: number;
  skipped: number;
  failed: number;
  error?: string;
};

const MONTHS_TO_SWEEP = 3;

function monthIso(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Últimos N meses (incluindo o corrente), do mais antigo pro mais novo. */
function recentMonthsIso(now: Date, n: number): string[] {
  const list: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(monthIso(d.getFullYear(), d.getMonth() + 1));
  }
  return list;
}

/**
 * Itera todos os households e gera as transactions recorrentes dos últimos
 * 3 meses (incluindo o corrente) em cada um. Usa o primeiro profile de cada
 * household como `profile_id` sintético. Idempotente em todas as camadas:
 * o `generateRecurringForMonthCore` pula regra que já tem transaction no mês.
 *
 * Por que 3 meses: se o cron falhar 1 ou 2 meses seguidos, o próximo run
 * preenche os gaps. Custo é baixo (3× queries × N households).
 */
export async function runRecurringCron(
  { serviceSupabase }: CronDeps,
  now: Date = new Date(),
): Promise<{ ok: true; summary: RecurringCronSummary[] }> {
  const months = recentMonthsIso(now, MONTHS_TO_SWEEP);
  const { data: households } = await serviceSupabase.from('households').select('id');

  const summary: RecurringCronSummary[] = [];
  for (const { id: householdId } of households ?? []) {
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!profile) {
      summary.push({ householdId, created: 0, skipped: 0, failed: 0, error: 'no profile' });
      continue;
    }

    const session: Session = {
      userId: profile.id,
      householdId,
      displayName: 'cron',
      preferredDisplayCurrency: 'EUR',
    };

    let created = 0;
    let skipped = 0;
    let failed = 0;
    let lastError: string | undefined;

    for (const month of months) {
      const result = await generateRecurringForMonthCore(
        { supabase: serviceSupabase, session },
        { monthIso: month },
      );
      if (!result.ok) {
        lastError = result.error;
        continue;
      }
      created += result.created;
      skipped += result.skipped;
      failed += result.failed;
    }

    summary.push({ householdId, created, skipped, failed, error: lastError });
  }

  return { ok: true, summary };
}

export type SnapshotCronSummary = {
  householdId: string;
  accountsSnapshotted: number;
  skipped: number;
  error?: string;
};

/**
 * Captura semanal do balance_cents de cada conta não-arquivada como snapshot
 * histórico com `source='auto'`. Idempotente — `ON CONFLICT DO NOTHING`
 * preserva snapshot já existente (auto ou manual). Roda toda madrugada de
 * domingo via Vercel Cron.
 */
export async function runSnapshotCron(
  { serviceSupabase }: CronDeps,
  now: Date = new Date(),
): Promise<{ ok: true; summary: SnapshotCronSummary[] }> {
  const snapshotDate = now.toISOString().slice(0, 10);
  const { data: households } = await serviceSupabase.from('households').select('id');
  const summary: SnapshotCronSummary[] = [];

  for (const { id: householdId } of households ?? []) {
    const { data: accounts, error: accErr } = await serviceSupabase
      .from('accounts')
      .select('id, balance_cents')
      .eq('household_id', householdId)
      .eq('is_archived', false);

    if (accErr) {
      summary.push({ householdId, accountsSnapshotted: 0, skipped: 0, error: accErr.message });
      continue;
    }
    if (!accounts || accounts.length === 0) {
      summary.push({ householdId, accountsSnapshotted: 0, skipped: 0 });
      continue;
    }

    const rows = accounts.map((a) => ({
      household_id: householdId,
      account_id: a.id,
      snapshot_date: snapshotDate,
      balance_cents: a.balance_cents,
      source: 'auto',
    }));

    // ON CONFLICT DO NOTHING via .upsert com ignoreDuplicates: snapshot
    // (auto ou manual) já existente pra (account, date) é preservado.
    const { error: insErr, data: inserted } = await serviceSupabase
      .from('account_balance_snapshots')
      .upsert(rows, {
        onConflict: 'account_id,snapshot_date',
        ignoreDuplicates: true,
      })
      .select('id');

    if (insErr) {
      summary.push({ householdId, accountsSnapshotted: 0, skipped: 0, error: insErr.message });
      continue;
    }

    const inserts = inserted?.length ?? 0;
    summary.push({
      householdId,
      accountsSnapshotted: inserts,
      skipped: accounts.length - inserts,
    });
  }

  return { ok: true, summary };
}

export type FxCronResult = { ok: true; rate: number; rateDate: string };

/**
 * Força refresh da cotação EUR→BRL no cache. Upsert garante idempotência se
 * rodar duas vezes no mesmo dia.
 */
export async function runFxCron(
  { serviceSupabase }: CronDeps,
  now: Date = new Date(),
): Promise<FxCronResult> {
  const result = await getRate({
    supabase: serviceSupabase,
    serviceSupabase,
    base: 'EUR',
    quote: 'BRL',
    when: now,
  });
  return { ok: true, rate: result.rate, rateDate: result.rateDate };
}
