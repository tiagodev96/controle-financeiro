import { getServerSupabase } from '@/lib/supabase/server';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export type DisplayCurrency = 'EUR' | 'BRL';

export type Session = {
  userId: string;
  householdId: string;
  preferredDisplayCurrency: DisplayCurrency;
};

export async function getSession(): Promise<Session> {
  const supabase = await getServerSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new UnauthorizedError();
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('household_id, preferred_display_currency')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new UnauthorizedError('Profile not found');
  }

  const pref = profile.preferred_display_currency;
  const preferredDisplayCurrency: DisplayCurrency =
    pref === 'BRL' ? 'BRL' : 'EUR';

  return {
    userId: user.id,
    householdId: profile.household_id,
    preferredDisplayCurrency,
  };
}
