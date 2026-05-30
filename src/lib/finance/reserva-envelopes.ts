import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Currency } from '@/components/finance/num';

export const RESERVE_ENVELOPE_NAMES: Record<Currency, string> = {
  BRL: 'Reserva (R$)',
  EUR: 'Reserva (€)',
};

const RESERVE_CURRENCIES: Currency[] = ['EUR', 'BRL'];

export type ReserveEnvelope = {
  id: string;
  name: string;
  currency: Currency;
  currentCents: number;
  targetCents: number | null;
};

type EnvelopeRow = {
  id: string;
  name: string;
  currency: string;
  current_cents: number;
  target_cents: number | null;
};

function toReserveEnvelope(row: EnvelopeRow): ReserveEnvelope {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency as Currency,
    currentCents: row.current_cents,
    targetCents: row.target_cents,
  };
}

export async function loadReserveEnvelopes(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<ReserveEnvelope[]> {
  const { data, error } = await supabase
    .from('envelopes')
    .select('id, name, currency, current_cents, target_cents')
    .eq('household_id', householdId)
    .eq('is_reserve', true)
    .order('currency', { ascending: true });
  if (error) throw new Error(`loadReserveEnvelopes: ${error.message}`);
  return (data ?? []).map(toReserveEnvelope);
}

/**
 * Garante uma subconta de reserva por moeda (R$ e €). Por moeda, na ordem:
 * usa a reserva existente; senão adota um envelope com o nome reservado
 * (evita violar o unique household+name); senão cria zerado. Idempotente —
 * o índice parcial garante no máximo uma reserva por (household, moeda).
 */
export async function ensureReserveEnvelopes(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<ReserveEnvelope[]> {
  for (const currency of RESERVE_CURRENCIES) {
    const { data: existingReserve, error: reserveError } = await supabase
      .from('envelopes')
      .select('id')
      .eq('household_id', householdId)
      .eq('currency', currency)
      .eq('is_reserve', true)
      .maybeSingle();
    if (reserveError) throw new Error(`ensureReserveEnvelopes (read): ${reserveError.message}`);
    if (existingReserve) continue;

    const name = RESERVE_ENVELOPE_NAMES[currency];
    const { data: named, error: namedError } = await supabase
      .from('envelopes')
      .select('id')
      .eq('household_id', householdId)
      .eq('name', name)
      .maybeSingle();
    if (namedError) throw new Error(`ensureReserveEnvelopes (named): ${namedError.message}`);

    if (named) {
      const { error } = await supabase
        .from('envelopes')
        .update({ is_reserve: true })
        .eq('id', named.id);
      if (error) throw new Error(`ensureReserveEnvelopes (adopt): ${error.message}`);
      continue;
    }

    const { error } = await supabase.from('envelopes').insert({
      household_id: householdId,
      name,
      currency,
      current_cents: 0,
      is_reserve: true,
    });
    if (error) throw new Error(`ensureReserveEnvelopes (insert): ${error.message}`);
  }

  return loadReserveEnvelopes(supabase, householdId);
}
