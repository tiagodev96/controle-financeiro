import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, UnauthorizedError } from '@/lib/auth/session';
import { BottomNav } from '@/components/finance/bottom-nav';
import { DesktopSidebar } from '@/components/finance/desktop-sidebar';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Toaster } from '@/components/ui/sonner';
import { THEME_COOKIE, resolveTheme } from '@/lib/theme/cookie';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    await getSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/login');
    throw err;
  }

  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <div className="flex min-h-dvh bg-bg-base">
      <DesktopSidebar theme={theme} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border-soft bg-bg-base/90 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-14 w-full max-w-110 items-center justify-between px-4">
            <p className="text-sm font-semibold tracking-tight text-fg1">
              controle <span className="text-brand">·</span> cf
            </p>
            <ThemeToggle initialTheme={theme} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-110 flex-1 px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:max-w-5xl lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </main>

        <BottomNav />
      </div>

      <Toaster position="top-center" richColors closeButton={false} />
    </div>
  );
}
