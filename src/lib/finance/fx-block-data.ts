import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getRateHistory, type RatePoint } from '@/lib/fx';
import type { Database } from '@/types/database';
import { toIsoDate as isoDate } from '@/lib/dates';

const HISTORY_DAYS = 365;

function daysBefore(d: Date, days: number): string {
  const out = new Date(d);
  out.setDate(out.getDate() - days);
  return isoDate(out);
}

export const getFxBlockData = cache(
  async (nowIso: string): Promise<RatePoint[]> => {
    const supabase = (await getServerSupabase()) as SupabaseClient<Database>;
    const now = new Date(nowIso);

    return getRateHistory({
      supabase,
      serviceSupabase: getServiceRoleSupabase(),
      base: 'EUR',
      quote: 'BRL',
      from: daysBefore(now, HISTORY_DAYS),
      to: isoDate(now),
    });
  },
);
