import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route Handlers.
 * Lê e escreve cookies da request via `next/headers`.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Em Server Components puros (sem Action/Route Handler) o set falha.
          // Engolimos esse caso porque o middleware refresca a sessão.
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // intentional no-op
          }
        },
      },
    }
  );
}
