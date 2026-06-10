import Link from 'next/link';
import { cookies } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { getSession } from '@/lib/auth/session';
import { getRateMapSafe } from '@/lib/fx';
import { listAllCategoriesForHousehold } from '@/lib/finance/categories';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { listCategoriesWithLimits } from '@/lib/finance/category-limits';
import { LancarForm, type CategoryLimitInfo } from '@/components/finance/lancar-form';
import { EmptyState } from '@/components/finance/empty-state';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { DirectionToggle } from '@/components/finance/direction-toggle';

type Direction = 'expense' | 'income';

type Props = {
  searchParams: Promise<{ direction?: string }>;
};

function parseDirection(raw: string | undefined): Direction {
  return raw === 'income' ? 'income' : 'expense';
}

export default async function LancarPage({ searchParams }: Props) {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const params = await searchParams;
  const direction = parseDirection(params.direction);

  const [allCategories, allAccounts] = await Promise.all([
    listAllCategoriesForHousehold(supabase, session.householdId),
    listAllAccountsForHousehold(supabase, session.householdId),
  ]);

  const categories = allCategories
    .filter((c) => !c.is_archived && c.kind === direction)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon }));

  const accounts = allAccounts
    .filter((a) => !a.is_archived)
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency }));

  // Aviso de limite só faz sentido pra despesa. Best-effort: sem fx, gastos
  // em outra moeda ficam fora da conta (listCategoriesWithLimits flagga).
  let limitByCategoryId: Record<string, CategoryLimitInfo> = {};
  let fxRates: { EUR_BRL: number; BRL_EUR: number } | null = null;
  if (direction === 'expense') {
    const fxRateMap = await getRateMapSafe({
      supabase,
      serviceSupabase: getServiceRoleSupabase(),
    });
    fxRates = fxRateMap ? { EUR_BRL: fxRateMap.EUR_BRL, BRL_EUR: fxRateMap.BRL_EUR } : null;
    const limits = await listCategoriesWithLimits(supabase, session.householdId, fxRateMap);
    limitByCategoryId = Object.fromEntries(
      limits.map((l) => [
        l.id,
        { limitCents: l.limitCents, spentCents: l.spentCents, limitCurrency: l.limitCurrency },
      ]),
    );
  }

  const cookieStore = await cookies();
  const lastAccountId = cookieStore.get('cf_last_account_id')?.value ?? null;

  const isIncome = direction === 'income';

  return (
    <section className="space-y-5">
      <AppTopBar
        eyebrow={isIncome ? 'Nova entrada' : 'Nova despesa'}
        title={isIncome ? 'Lançar entrada' : 'Lançar despesa'}
        trailing={
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-sm px-2 text-sm text-fg3 hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Cancelar
          </Link>
        }
      />

      <DirectionToggle value={direction} />

      {categories.length === 0 ? (
        <EmptyState
          message={
            isIncome
              ? 'Crie ao menos uma categoria de entrada primeiro.'
              : 'Crie ao menos uma categoria primeiro.'
          }
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
          key={direction}
          categories={categories}
          accounts={accounts}
          lastAccountId={lastAccountId}
          direction={direction}
          limitByCategoryId={limitByCategoryId}
          fxRates={fxRates}
        />
      )}
    </section>
  );
}
