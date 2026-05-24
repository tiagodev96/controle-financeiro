'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Wallet,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/lancar', label: 'Lançar', Icon: PlusCircle },
  { href: '/transacoes', label: 'Transações', Icon: Receipt },
  { href: '/dividas', label: 'Dívidas', Icon: Wallet },
  { href: '/mais', label: 'Mais', Icon: Menu },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-bg-surface/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-teal' : 'text-fg3 hover:text-fg2'
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
