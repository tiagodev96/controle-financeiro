import { getServerSupabase } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { listRecurringRulesForHousehold, type RecurringRule } from '@/lib/finance/recurring';
import { listAllCategoriesForHousehold } from '@/lib/finance/categories';
import { listAllAccountsForHousehold } from '@/lib/finance/accounts';
import { AppTopBar } from '@/components/finance/app-top-bar';
import { CreateRecurringDialog } from '@/components/finance/recurring/create-dialog';
import { RecurringListItem } from '@/components/finance/recurring/list-item';
import { GenerateMonthButton } from '@/components/finance/recurring/generate-button';
import { MONTHS_PT_SHORT, monthIso as toMonthIso } from '@/lib/dates';

export default async function RecorrentesPage() {
  const session = await getSession();
  const supabase = await getServerSupabase();
  const now = new Date();

  const [{ active, paused, notGeneratedThisMonth }, allCategories, allAccounts] =
    await Promise.all([
      listRecurringRulesForHousehold(supabase, session.householdId, now),
      listAllCategoriesForHousehold(supabase, session.householdId),
      listAllAccountsForHousehold(supabase, session.householdId),
    ]);

  const monthIso = toMonthIso(now);
  const monthShort = MONTHS_PT_SHORT[now.getMonth()];
  const eyebrow =
    active.length === 0
      ? 'sem regras ativas'
      : notGeneratedThisMonth > 0
        ? `${active.length} ativas · ${notGeneratedThisMonth} não geradas em ${monthShort}`
        : `${active.length} ativas · tudo gerado em ${monthShort}`;

  // Filtra arquivadas pra não confundir UI da listagem do dialog.
  const categoriesForDialog = allCategories.filter((c) => !c.is_archived);
  const accountsForDialog = allAccounts.filter((a) => !a.is_archived);

  return (
    <section className="space-y-6">
      <AppTopBar
        eyebrow={eyebrow}
        title="Recorrentes"
        trailing={
          <div className="flex items-center gap-2">
            <GenerateMonthButton monthIso={monthIso} />
            <CreateRecurringDialog
              categories={categoriesForDialog}
              accounts={accountsForDialog}
            />
          </div>
        }
      />

      {active.length === 0 && paused.length === 0 ? (
        <p className="rounded-md border border-border-soft bg-bg-surface p-6 text-center text-sm text-fg3">
          Sem regras ainda. Crie a primeira pra automatizar os lançamentos mensais.
        </p>
      ) : (
        <>
          {active.length > 0 && (
            <Section
              label="Ativas"
              rules={active}
              categories={categoriesForDialog}
              accounts={accountsForDialog}
            />
          )}
          {paused.length > 0 && (
            <Section
              label={`Pausadas (${paused.length})`}
              rules={paused}
              paused
              categories={categoriesForDialog}
              accounts={accountsForDialog}
            />
          )}
        </>
      )}
    </section>
  );
}

type SectionAccount = { id: string; name: string; currency: 'BRL' | 'EUR' };
type SectionCategory = { id: string; name: string; kind: 'expense' | 'income' };

function Section({
  label,
  rules,
  paused = false,
  categories,
  accounts,
}: {
  label: string;
  rules: RecurringRule[];
  paused?: boolean;
  categories: SectionCategory[];
  accounts: SectionAccount[];
}) {
  return (
    <section className="space-y-2">
      <p className="eyebrow px-1">{label}</p>
      <div className="divide-y divide-border-soft rounded-md border border-border-soft bg-bg-surface px-3">
        {rules.map((r) => (
          <RecurringListItem
            key={r.id}
            id={r.id}
            title={r.title}
            amountCents={r.amount_cents}
            currency={r.currency}
            direction={r.direction}
            dayOfMonth={r.day_of_month}
            paused={paused}
            categoryId={r.category_id}
            accountId={r.account_id}
            notes={r.notes}
            categories={categories}
            accounts={accounts}
          />
        ))}
      </div>
    </section>
  );
}
