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

function currentMonthIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Itera todos os households e gera as transactions recorrentes do mês corrente
 * em cada um. Usa o primeiro profile de cada household como `profile_id`
 * sintético para as transactions geradas. Idempotente: roda de novo só cria
 * transactions que ainda não foram criadas no mês.
 */
export async function runRecurringCron(
  { serviceSupabase }: CronDeps,
  now: Date = new Date(),
): Promise<{ ok: true; summary: RecurringCronSummary[] }> {
  const monthIso = currentMonthIso(now);

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
      preferredDisplayCurrency: 'EUR',
    };
    const result = await generateRecurringForMonthCore(
      { supabase: serviceSupabase, session },
      { monthIso },
    );

    if (!result.ok) {
      summary.push({ householdId, created: 0, skipped: 0, failed: 0, error: result.error });
    } else {
      summary.push({
        householdId,
        created: result.created,
        skipped: result.skipped,
        failed: result.failed,
      });
    }
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
