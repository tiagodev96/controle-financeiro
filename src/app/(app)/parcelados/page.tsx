import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { CreateInstallmentDialog } from '@/components/finance/installments/create-dialog';
import { InstallmentListItem } from '@/components/finance/installments/list-item';
import {
  listInstallmentPlansForHousehold,
  splitInstallments,
  type InstallmentPlanWithProgress,
} from '@/lib/finance/installments';
import { listAllCategoriesForHousehold } from '@/lib/finance/categories';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';

export default async function ParceladosPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const [{ active, finished }, allCategories, allAccounts] = await Promise.all([
    listInstallmentPlansForHousehold(supabase, session.householdId),
    listAllCategoriesForHousehold(supabase, session.householdId),
    listAllAccountsForHousehold(supabase, session.householdId),
  ]);

  const categories = allCategories.filter((c) => !c.is_archived);
  const accounts = allAccounts.filter((a) => !a.is_archived);

  const eyebrow =
    active.length === 0 && finished.length === 0
      ? 'nada cadastrado'
      : `${active.length} em andamento${finished.length > 0 ? ` · ${finished.length} quitado${finished.length === 1 ? '' : 's'}` : ''}`;

  return (
    <section className="space-y-6">
      <AppTopBar
        eyebrow={eyebrow}
        title="Parcelados"
        trailing={
          <CreateInstallmentDialog
            categories={categories}
            accounts={accounts}
          />
        }
      />

      {active.length === 0 && finished.length === 0 ? (
        <p className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
          Sem parcelados cadastrados. Crie o primeiro pra parar de lançar parcela por parcela.
        </p>
      ) : (
        <>
          {active.length > 0 && (
            <Section label="Em andamento" plans={active} categories={categories} accounts={accounts} />
          )}
          {finished.length > 0 && (
            <Section
              label={`Quitados (${finished.length})`}
              plans={finished}
              categories={categories}
              accounts={accounts}
            />
          )}
        </>
      )}
    </section>
  );
}

type CategoryProp = { id: string; name: string; kind: 'expense' | 'income' };
type AccountProp = { id: string; name: string; currency: 'EUR' | 'BRL' };

function Section({
  label,
  plans,
  categories,
  accounts,
}: {
  label: string;
  plans: InstallmentPlanWithProgress[];
  categories: CategoryProp[];
  accounts: AccountProp[];
}) {
  return (
    <section className="space-y-2">
      <p className="eyebrow px-1">{label}</p>
      <div className="flex flex-col gap-2.5">
        {plans.map((p) => {
          const parts = splitInstallments(p.total_amount_cents, p.total_installments);
          const perInstallment = parts[0] ?? 0;
          return (
            <InstallmentListItem
              key={p.id}
              id={p.id}
              title={p.title}
              notes={p.notes}
              categoryId={p.category_id}
              accountId={p.account_id}
              totalCents={p.total_amount_cents}
              perInstallmentCents={perInstallment}
              currency={p.currency}
              totalInstallments={p.total_installments}
              paidCount={p.paidCount}
              pendingCount={p.pendingCount}
              isFinished={p.isFinished}
              firstDueDate={p.first_due_date}
              categories={categories}
              accounts={accounts}
            />
          );
        })}
      </div>
    </section>
  );
}
