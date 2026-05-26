import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { listAllCategoriesForHousehold } from '@/lib/finance/categories';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { CreateCategoryDialog } from '@/components/finance/categories/create-dialog';
import { CategoryListItem } from '@/components/finance/categories/list-item';

export default async function CategoriasPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();

  const all = await listAllCategoriesForHousehold(supabase, session.householdId);
  const expense = all.filter((c) => c.kind === 'expense' && !c.is_archived);
  const income = all.filter((c) => c.kind === 'income' && !c.is_archived);
  const archived = all.filter((c) => c.is_archived);

  return (
    <section className="space-y-6">
      <AppTopBar
        eyebrow={`${expense.length + income.length} ativas`}
        title="Categorias"
        trailing={<CreateCategoryDialog />}
      />

      <Section label="Despesa" rows={expense} />
      <Section label="Entrada" rows={income} />

      {archived.length > 0 && (
        <Section label={`Arquivadas (${archived.length})`} rows={archived} archived />
      )}
    </section>
  );
}

type Row = {
  id: string;
  name: string;
  icon: string | null;
  kind: 'expense' | 'income';
  monthly_limit_cents: number | null;
};

function Section({ label, rows, archived = false }: { label: string; rows: Row[]; archived?: boolean }) {
  if (rows.length === 0 && !archived) {
    return (
      <section className="space-y-2">
        <p className="eyebrow px-1">{label}</p>
        <p className="rounded-md border border-border-soft bg-bg-surface p-4 text-center text-sm text-fg3">
          Sem categorias neste tipo.
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <p className="eyebrow px-1">{label}</p>
      <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
        {rows.map((c) => (
          <CategoryListItem
            key={c.id}
            id={c.id}
            name={c.name}
            icon={c.icon}
            monthlyLimitCents={c.monthly_limit_cents}
            isExpenseKind={c.kind === 'expense'}
            archived={archived}
          />
        ))}
      </div>
    </section>
  );
}
