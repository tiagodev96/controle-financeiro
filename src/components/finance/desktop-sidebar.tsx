'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  Receipt,
  CreditCard,
  Repeat,
  Tags,
  Wallet,
  Share2,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import type { Theme } from '@/lib/theme/cookie';

type Item = {
  href: string;
  label: string;
  Icon: LucideIcon;
  shortcut?: string;
};

const items: Item[] = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/lancar', label: 'Lançar', Icon: Plus, shortcut: 'L' },
  { href: '/transacoes', label: 'Transações', Icon: Receipt },
  { href: '/dividas', label: 'Dívidas', Icon: CreditCard },
  { href: '/recorrentes', label: 'Recorrentes', Icon: Repeat },
  { href: '/parcelados', label: 'Parcelados', Icon: CalendarRange },
  { href: '/contas', label: 'Contas', Icon: Wallet },
  { href: '/categorias', label: 'Categorias', Icon: Tags },
  { href: '/resumo', label: 'Resumo do mês', Icon: Share2 },
];

type Props = {
  theme: Theme;
  displayName: string;
};

export function DesktopSidebar({ theme, displayName }: Props) {
  const pathname = usePathname();
  const initial = displayName.trim().charAt(0).toUpperCase() || '·';

  return (
    <aside
      aria-label="Navegação principal"
      className="hidden lg:flex flex-col gap-1 border-r border-border-soft bg-bg-surface px-3.5 py-5 sticky top-0 h-dvh w-[220px] shrink-0"
    >
      <div className="flex items-center justify-between gap-2 px-2 pb-3">
        <LedgerLogo />
        <ThemeToggle initialTheme={theme} />
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map(({ href, label, Icon, shortcut }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-quiet-bg text-brand-quiet-fg font-semibold'
                  : 'text-fg2 hover:bg-bg-raised hover:text-fg1',
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 1.9 : 1.6} aria-hidden />
              <span className="flex-1">{label}</span>
              {shortcut && (
                <kbd className="mono rounded-xs border border-border-soft bg-bg-inset px-1.5 py-px text-[10px] text-fg3">
                  {shortcut}
                </kbd>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 rounded-md border border-border-soft bg-bg-inset px-3 py-2.5">
        <span className="flex size-7 items-center justify-center rounded-full bg-brand-quiet-bg text-xs font-bold text-brand-quiet-fg">
          {initial}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-semibold text-fg1">{displayName}</span>
        </div>
      </div>
    </aside>
  );
}

function LedgerLogo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 64 64" fill="none" aria-hidden>
        <rect x="6" y="8" width="52" height="48" rx="3" stroke="var(--fg2)" strokeWidth="2" />
        <line x1="14" y1="22" x2="50" y2="22" stroke="var(--border-strong)" strokeWidth="1.5" />
        <line x1="14" y1="30" x2="42" y2="30" stroke="var(--border-strong)" strokeWidth="1.5" />
        <line x1="14" y1="38" x2="46" y2="38" stroke="var(--border-strong)" strokeWidth="1.5" />
        <line x1="14" y1="46" x2="36" y2="46" stroke="var(--border-strong)" strokeWidth="1.5" />
        <rect x="42" y="42" width="10" height="2" fill="var(--brand)" />
      </svg>
      <span className="text-[13px] font-bold tracking-tight text-fg1">
        controle<span className="mx-0.5 font-normal text-fg4">·</span>cf
      </span>
    </span>
  );
}
