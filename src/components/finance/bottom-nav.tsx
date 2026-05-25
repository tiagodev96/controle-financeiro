'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  Receipt,
  CreditCard,
  Menu,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; Icon: LucideIcon };

const items: Item[] = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/lancar', label: 'Lançar', Icon: Plus },
  { href: '/transacoes', label: 'Transações', Icon: Receipt },
  { href: '/dividas', label: 'Dívidas', Icon: CreditCard },
  { href: '/mais', label: 'Mais', Icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-bg-base/92 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-110 grid-cols-5">
        {items.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-brand' : 'text-fg3 hover:text-fg1',
                )}
              >
                <Icon className="size-5.5" strokeWidth={1.6} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
