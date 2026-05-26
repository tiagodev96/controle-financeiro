import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type CategoryKind = 'expense' | 'income' | 'transfer';

export type CategoryOption = {
  id: string;
  name: string;
  icon: string | null;
};

export type CategoryFull = {
  id: string;
  name: string;
  icon: string | null;
  kind: 'expense' | 'income';
  is_archived: boolean;
  sort_order: number;
};

/**
 * Lista todas categorias (ativas + arquivadas) do household, agnóstica de
 * uso. Pra UI de CRUD em /categorias. Sem ranking — ordem é sort_order asc.
 */
export async function listAllCategoriesForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<CategoryFull[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, icon, kind, is_archived, sort_order')
    .eq('household_id', householdId)
    .neq('kind', 'transfer')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`listAllCategoriesForHousehold: ${error.message}`);
  return (data ?? []) as CategoryFull[];
}

type ListOptions = {
  kind?: CategoryKind;
};

// Duas queries em vez de `categories.select('transactions(count)')`: o agregado
// embutido do PostgREST não respeita o filtro de household_id da categoria e
// retorna 0 pra todas.
export async function listTopCategoriesForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
  limit: number,
  options: ListOptions = {},
): Promise<CategoryOption[]> {
  const kind = options.kind ?? 'expense';

  const [categoriesRes, txRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, icon, sort_order')
      .eq('household_id', householdId)
      .eq('kind', kind)
      .eq('is_archived', false),
    supabase
      .from('transactions')
      .select('category_id')
      .eq('household_id', householdId)
      .eq('direction', kind === 'income' ? 'income' : 'expense')
      .not('category_id', 'is', null),
  ]);

  if (categoriesRes.error) {
    throw new Error(`listTopCategoriesForHousehold: ${categoriesRes.error.message}`);
  }
  if (txRes.error) {
    throw new Error(`listTopCategoriesForHousehold (tx): ${txRes.error.message}`);
  }
  if (!categoriesRes.data) return [];

  const counts = new Map<string, number>();
  for (const row of txRes.data ?? []) {
    if (!row.category_id) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  return categoriesRes.data
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon ?? null,
      sortOrder: c.sort_order ?? 0,
      txCount: counts.get(c.id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
      return a.sortOrder - b.sortOrder;
    })
    .slice(0, limit)
    .map(({ id, name, icon }) => ({ id, name, icon }));
}
