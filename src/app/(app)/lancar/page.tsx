import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import { listTopCategoriesForHousehold } from '@/lib/finance/categories';
import { LancarForm } from '@/components/finance/lancar-form';

const TOP_CATEGORIES_LIMIT = 6;

export default async function LancarPage() {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect('/login');
    }
    throw err;
  }

  const supabase = await getServerSupabase();
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

  const cookieStore = await cookies();
  const lastAccountId = cookieStore.get('cf_last_account_id')?.value ?? null;

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <p className="caption text-fg3">Nova despesa</p>
        <h1>Lançar despesa</h1>
      </header>

      {categories.length === 0 ? (
        <EmptyState
          message="Crie ao menos uma categoria primeiro."
          ctaHref="/categorias"
          ctaLabel="Criar categoria"
        />
      ) : accounts.length === 0 ? (
        <EmptyState
          message="Crie ao menos uma conta primeiro."
          ctaHref="/contas"
          ctaLabel="Criar conta"
        />
      ) : (
        <LancarForm
          categories={categories}
          accounts={accounts}
          lastAccountId={lastAccountId}
        />
      )}
    </section>
  );
}

function EmptyState({
  message,
  ctaHref,
  ctaLabel,
}: {
  message: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-bg-surface p-4">
      <p className="text-fg2">{message}</p>
      <Link
        href={ctaHref}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal px-4 py-2 font-semibold text-on-primary transition-colors hover:bg-teal/90"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
