import type { BrowserContext } from '@playwright/test';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const DEFAULT_EMAIL = 'tiago@example.com';
const DEFAULT_PASSWORD = 'password-local';
const APP_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

type LoginOptions = {
  email?: string;
  password?: string;
  baseURL?: string;
};

type StoredCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Autentica um usuário de teste contra o Supabase local e injeta os cookies
 * de sessão no BrowserContext do Playwright. Usa o próprio createServerClient
 * com um cookie jar em memória para que o formato dos cookies (split em chunks,
 * naming sb-<ref>-auth-token, base64) seja exatamente o que o app espera.
 *
 * Pré-requisitos: Supabase local rodando e seed aplicado (usuário existe).
 */
export async function loginAsTestUser(
  context: BrowserContext,
  {
    email = DEFAULT_EMAIL,
    password = DEFAULT_PASSWORD,
    baseURL = APP_BASE_URL,
  }: LoginOptions = {}
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidos no ambiente.'
    );
  }

  const jar = new Map<string, StoredCookie>();

  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return Array.from(jar.values()).map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          jar.set(name, { name, value, options });
        }
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`loginAsTestUser: signIn failed para ${email}: ${error.message}`);
  }

  const url = new URL(baseURL);
  const cookies = Array.from(jar.values()).map(({ name, value, options }) => ({
    name,
    value,
    domain: url.hostname,
    path: options.path ?? '/',
    httpOnly: options.httpOnly ?? false,
    secure: options.secure ?? false,
    sameSite: normalizeSameSite(options.sameSite),
    // Sem expires aqui: o refresh_token do supabase já cuida da renovação,
    // e cookies sem expires ficam como session cookies no browser do Playwright.
  }));

  await context.addCookies(cookies);
}

function normalizeSameSite(
  value: CookieOptions['sameSite']
): 'Strict' | 'Lax' | 'None' {
  if (value === 'strict' || value === true) return 'Strict';
  if (value === 'none') return 'None';
  return 'Lax';
}
