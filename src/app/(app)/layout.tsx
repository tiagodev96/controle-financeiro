import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import { listTopCategoriesForHousehold } from '@/lib/finance/categories';
import { BottomNav } from '@/components/finance/bottom-nav';
import { LancarSheet } from '@/components/finance/lancar-sheet';
import { MaisSheet } from '@/components/finance/mais-sheet';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { THEME_COOKIE, resolveTheme } from '@/lib/theme/cookie';

const TOP_CATEGORIES_LIMIT = 6;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login');
    throw err;
  }

  const supabase = await getServerSupabase();
  const cookieStore = await cookies();

  const [categories, accountsRes] = await Promise.all([
    listTopCategoriesForHousehold(supabase, session.householdId, TOP_CATEGORIES_LIMIT),
    supabase
      .from('accounts')
      .select('id, name, currency')
      .eq('is_archived', false)
      .order('sort_order', { ascending: true }),
  ]);

  const accounts = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency as 'BRL' | 'EUR',
  }));

  const lastAccountId = cookieStore.get('cf_last_account_id')?.value ?? null;
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <p className="text-sm font-medium tracking-tight text-fg">controle financeiro</p>
          <ThemeToggle initialTheme={theme} />
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-md flex-1 px-4 pt-5"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      <BottomNav />

      <Suspense fallback={null}>
        <LancarSheet
          categories={categories}
          accounts={accounts}
          lastAccountId={lastAccountId}
        />
        <MaisSheet />
      </Suspense>
    </div>
  );
}
