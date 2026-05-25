'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { LancarForm } from '@/components/finance/lancar-form';
import { EmptyState } from '@/components/finance/empty-state';

type Account = { id: string; name: string; currency: 'BRL' | 'EUR' };
type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  accounts: Account[];
  lastAccountId: string | null;
};

export function LancarSheet({ categories, accounts, lastAccountId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get('sheet') === 'lancar';

  function handleOpenChange(next: boolean) {
    if (!next) router.push(pathname);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-lg pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>Nova despesa</SheetTitle>
          <SheetDescription>
            Lance um gasto em segundos. A categoria mais usada já vem ativa.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {categories.length === 0 ? (
            <EmptyState
              message="Crie ao menos uma categoria primeiro."
              ctaHref="/categorias"
              ctaLabel="Criar categoria"
            />
          ) : accounts.length === 0 ? (
            <EmptyState
              message="Crie ao menos uma conta primeiro."
              ctaHref="/contas"
              ctaLabel="Criar conta"
            />
          ) : (
            <LancarForm
              categories={categories}
              accounts={accounts}
              lastAccountId={lastAccountId}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
