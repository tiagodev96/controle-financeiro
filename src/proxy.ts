import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Next.js 16: Middleware foi renomeado para Proxy. Arquivo: src/proxy.ts.
//
// Responsabilidades:
//  1. Refrescar a sessão Supabase a cada request (getUser cuida do refresh).
//  2. Redirecionar anônimos pra /login.
//  3. Redirecionar autenticados que pousam em /login pra /.
//
// Roda em TODA request HTML/Action (matcher exclui assets estáticos).
// Evitar lógica pesada aqui — getUser bate no auth server, é o único custo.

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === '/login';

  if (!user && !isLoginRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isLoginRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  // Exclui assets estáticos do Next, favicon, e qualquer arquivo com extensão
  // (svg, png, js, css). Tudo o mais — incluindo Server Actions — passa pelo proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
