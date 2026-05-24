import { loadEnvConfig } from '@next/env';

/**
 * Setup global do Playwright. Carrega `.env.local` (e demais .env*) usando o
 * mesmo loader que o `next dev` usa, para que helpers como `loginAsTestUser`
 * leiam as variáveis Supabase do mesmo lugar que o app.
 */
export default async function globalSetup() {
  loadEnvConfig(process.cwd());
}
