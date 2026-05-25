import Link from 'next/link';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { listTopCategoriesForHousehold } from '@/lib/finance/categories';
import { LancarForm } from '@/components/finance/lancar-form';
import { EmptyState } from '@/components/finance/empty-state';
import { AppTopBar } from '@/components/finance/app-top-bar';

const TOP_CATEGORIES_LIMIT = 6;

export default async function LancarPage() {
  const session = await getSession();
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
      <AppTopBar
        eyebrow="Nova despesa"
        title="Lançar despesa"
        trailing={
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-sm px-2 text-sm text-fg3 hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancelar
          </Link>
        }
      />

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
