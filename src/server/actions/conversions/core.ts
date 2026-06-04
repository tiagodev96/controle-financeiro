import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Session } from '@/lib/auth/session';
import { getRateOn } from '@/lib/fx';

type ConversionRow = Database['public']['Tables']['currency_conversions']['Row'];

const GENERIC = 'Não foi possível salvar.';
const NOT_FOUND = 'Conversão não encontrada.';

const recordSchema = z
  .object({
    fromCurrency: z.enum(['BRL', 'EUR']),
    toCurrency: z.enum(['BRL', 'EUR']),
    fromAmountCents: z.number().int().positive(),
    toAmountCents: z.number().int().positive(),
    convertedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
    note: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().max(120))
      .optional(),
  })
  .refine((v) => v.fromCurrency !== v.toCurrency, {
    message: 'Moedas devem ser diferentes.',
  });

const deleteSchema = z.object({ conversionId: z.string().uuid() });

export type RecordConversionInput = z.input<typeof recordSchema>;
export type DeleteConversionInput = z.input<typeof deleteSchema>;

export type RecordConversionResult =
  | { ok: true; conversion: ConversionRow }
  | { ok: false; error: string };
export type ConversionMutationResult = { ok: true } | { ok: false; error: string };

type Deps = {
  supabase: SupabaseClient<Database>;
  session: Session;
};

type RecordDeps = Deps & {
  serviceSupabase: SupabaseClient<Database>;
};

export async function recordConversionCore(
  { supabase, session, serviceSupabase }: RecordDeps,
  input: RecordConversionInput,
): Promise<RecordConversionResult> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  }
  const data = parsed.data;

  const effectiveRate = data.toAmountCents / data.fromAmountCents;

  const midMarketRate = await getRateOn({
    supabase,
    serviceSupabase,
    base: data.fromCurrency,
    quote: data.toCurrency,
    date: data.convertedOn,
  });

  const { data: row, error } = await supabase
    .from('currency_conversions')
    .insert({
      household_id: session.householdId,
      profile_id: session.userId,
      from_currency: data.fromCurrency,
      to_currency: data.toCurrency,
      from_amount_cents: data.fromAmountCents,
      to_amount_cents: data.toAmountCents,
      effective_rate: effectiveRate,
      mid_market_rate: midMarketRate,
      converted_on: data.convertedOn,
      note: data.note && data.note.length > 0 ? data.note : null,
    })
    .select()
    .single();

  if (error || !row) return { ok: false, error: GENERIC };
  return { ok: true, conversion: row };
}

export async function deleteConversionCore(
  { supabase, session }: Deps,
  input: DeleteConversionInput,
): Promise<ConversionMutationResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: GENERIC };

  const { data: existing } = await supabase
    .from('currency_conversions')
    .select('id, household_id')
    .eq('id', parsed.data.conversionId)
    .maybeSingle();
  if (!existing || existing.household_id !== session.householdId) {
    return { ok: false, error: NOT_FOUND };
  }

  const { error } = await supabase
    .from('currency_conversions')
    .delete()
    .eq('id', parsed.data.conversionId);

  if (error) return { ok: false, error: GENERIC };
  return { ok: true };
}
