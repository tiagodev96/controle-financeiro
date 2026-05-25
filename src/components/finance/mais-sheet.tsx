'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Receipt,
  CreditCard,
  Repeat,
  Tags,
  Wallet,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type Item = {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
};

const items: Item[] = [
  { href: '/transacoes', label: 'Transações', description: 'Histórico completo', Icon: Receipt },
  { href: '/dividas', label: 'Dívidas', description: 'Saldo em aberto e parcelas', Icon: CreditCard },
  { href: '/recorrentes', label: 'Recorrentes', description: 'Regras mensais', Icon: Repeat },
  { href: '/categorias', label: 'Categorias', description: 'Cadastro', Icon: Tags },
  { href: '/contas', label: 'Contas', description: 'Cadastro', Icon: Wallet },
  { href: '/resumo', label: 'Resumo', description: 'Exportar semana', Icon: Share2 },
];

export function MaisSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get('sheet') === 'mais';

  function handleOpenChange(next: boolean) {
    if (!next) router.push(pathname);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto rounded-t-lg pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>Mais</SheetTitle>
        </SheetHeader>

        <ul className="grid grid-cols-2 gap-2 px-4 pb-6">
          {items.map(({ href, label, description, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col gap-2 rounded-md border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-5 text-fg-muted" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-fg">{label}</p>
                  <p className="text-xs text-fg-muted">{description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
