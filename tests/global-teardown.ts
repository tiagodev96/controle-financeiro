import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

const SEED_DEMO_HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';

/**
 * Limpa os dados mutáveis que os specs E2E criam no household demo
 * (transactions, recurring_rules, debts, installment_plans). Sem isso, rodar
 * `test:e2e` antes de `test:run` deixa lixo que quebra testes de integração
 * que assumem o demo no estado do seed (contas/categorias só).
 *
 * Não toca accounts/categories (seed) nem outros households.
 */
export default async function globalTeardown(): Promise<void> {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // transactions primeiro: referenciam debts/installment_plans/recurring_rules.
  for (const table of ['transactions', 'recurring_rules', 'debts', 'installment_plans'] as const) {
    const { error } = await admin.from(table).delete().eq('household_id', SEED_DEMO_HOUSEHOLD_ID);
    if (error) {
      throw new Error(`globalTeardown: limpando ${table}: ${error.message}`);
    }
  }
}
