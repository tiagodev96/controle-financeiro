import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type CategoryOption = {
  id: string;
  name: string;
};

/**
 * Retorna até `limit` categorias de despesa do household, ordenadas por uso
 * decrescente (count de transactions). Em empate, ordena por sort_order
 * crescente. Categorias arquivadas são excluídas.
 *
 * Implementação: duas queries (categorias + transactions) e join client-side.
 * Tentamos `categories.select('transactions(count)')` mas o agregado embutido
 * do PostgREST não respeita o filtro de household_id da categoria, retornando
 * 0 pra todos. Duas queries fica explícito e correto.
 */
export async function listTopCategoriesForHousehold(
  supabase: SupabaseClient<Database>,
  householdId: string,
  limit: number
): Promise<CategoryOption[]> {
  const [categoriesRes, txRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, sort_order')
      .eq('household_id', householdId)
      .eq('kind', 'expense')
      .eq('is_archived', false),
    supabase
      .from('transactions')
      .select('category_id')
      .eq('household_id', householdId)
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
      sortOrder: c.sort_order ?? 0,
      txCount: counts.get(c.id) ?? 0,
    }))
    .sort((a, b) => {
      if (b.txCount !== a.txCount) return b.txCount - a.txCount;
      return a.sortOrder - b.sortOrder;
    })
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }));
}
