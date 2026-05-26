'use client';

import { createElement, useState, useTransition } from 'react';
import { Archive, Edit3, MoreHorizontal, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { resolveCategoryIcon } from '@/lib/finance/category-icons';
import {
  archiveCategoryAction,
  deleteCategoryAction,
  unarchiveCategoryAction,
} from '@/server/actions/categories/actions';
import { EditCategoryDialog } from './edit-dialog';
import { cn } from '@/lib/utils';

const PROTECTED_NAME = 'Outros';

type Props = {
  id: string;
  name: string;
  icon: string | null;
  monthlyLimitCents: number | null;
  isExpenseKind: boolean;
  archived: boolean;
};

export function CategoryListItem({
  id,
  name,
  icon,
  monthlyLimitCents,
  isExpenseKind,
  archived,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleArchive() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await archiveCategoryAction({ categoryId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Arquivada.');
    });
  }

  function handleUnarchive() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await unarchiveCategoryAction({ categoryId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Desarquivada.');
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await deleteCategoryAction({ categoryId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Categoria excluída. Lançamentos movidos pra "Outros".');
    });
  }

  const isProtected = name === PROTECTED_NAME;

  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2.5',
        archived && 'opacity-60',
      )}
    >
      {createElement(resolveCategoryIcon({ name, icon }), {
        className: 'size-4 text-fg3',
        strokeWidth: 1.6,
        'aria-hidden': true,
      })}

      <button
        type="button"
        onClick={() => !archived && setEditOpen(true)}
        disabled={archived || pending}
        className="flex min-w-0 flex-1 flex-col text-left disabled:cursor-default"
      >
        <span className="truncate text-[15px] text-fg1">{name}</span>
        {isExpenseKind && monthlyLimitCents != null && monthlyLimitCents > 0 && (
          <span className="mono text-[10px] text-fg4">
            limite € {(monthlyLimitCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
          </span>
        )}
      </button>

      <div className="relative">
        <button
          type="button"
          aria-label={`Ações para ${name}`}
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex size-8 items-center justify-center rounded-md text-fg3 transition-colors hover:bg-bg-raised hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.6} aria-hidden />
        </button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div className="absolute right-0 top-9 z-40 min-w-40 rounded-md border border-border-soft bg-bg-raised py-1 shadow-md">
              {!archived && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                >
                  <Edit3 className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Editar
                </button>
              )}
              {archived ? (
                <button
                  type="button"
                  onClick={handleUnarchive}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                >
                  <Undo2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Desarquivar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleArchive}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                >
                  <Archive className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Arquivar
                </button>
              )}
              {!isProtected && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-money-negative hover:bg-bg-inset"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Excluir
                </button>
              )}
              {isProtected && (
                <p className="px-3 py-1.5 text-[11px] text-fg4">
                  Backup das categorias excluídas.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {editOpen && (
        <EditCategoryDialog
          categoryId={id}
          currentName={name}
          currentIcon={icon}
          currentMonthlyLimitCents={monthlyLimitCents}
          nameLocked={isProtected}
          isExpenseKind={isExpenseKind}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
}
