'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Plus, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/', label: 'Início', Icon: Home, kind: 'route' as const },
  { href: '?sheet=lancar', label: 'Lançar', Icon: Plus, kind: 'sheet' as const, sheet: 'lancar' },
  { href: '?sheet=mais', label: 'Mais', Icon: Menu, kind: 'sheet' as const, sheet: 'mais' },
];

export function BottomNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const openSheet = params.get('sheet');

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {items.map((item) => {
          const active =
            item.kind === 'route'
              ? pathname === '/' && !openSheet
              : openSheet === item.sheet;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-fg-muted hover:text-fg',
                )}
              >
                <item.Icon className="size-5" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
