'use client';

import { createElement, useState, useTransition, useRef, useEffect } from 'react';
import { Archive, Edit3, MoreHorizontal, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { iconForCategory } from '@/lib/finance/category-icons';
import {
  archiveCategoryAction,
  deleteCategoryAction,
  renameCategoryAction,
  unarchiveCategoryAction,
} from '@/server/actions/categories/actions';
import { cn } from '@/lib/utils';

const PROTECTED_NAME = 'Outros';

type Props = {
  id: string;
  name: string;
  archived: boolean;
};

export function CategoryListItem({ id, name, archived }: Props) {
  const [editing, setEditing] = useState(false);
  // Derived state pattern (React docs): re-sync sem useEffect quando prop muda.
  const [prevName, setPrevName] = useState(name);
  const [value, setValue] = useState(name);
  if (name !== prevName) {
    setPrevName(name);
    setValue(name);
  }

  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commitRename() {
    const trimmed = value.trim();
    setEditing(false);
    if (!trimmed || trimmed === name) {
      setValue(name);
      return;
    }
    startTransition(async () => {
      const result = await renameCategoryAction({ categoryId: id, name: trimmed });
      if (!result.ok) {
        toast.error(result.error);
        setValue(name);
      }
    });
  }

  function cancelRename() {
    setEditing(false);
    setValue(name);
  }

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
      {createElement(iconForCategory(name), {
        className: 'size-4 text-fg3',
        strokeWidth: 1.6,
        'aria-hidden': true,
      })}

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              cancelRename();
            }
          }}
          disabled={pending}
          className="min-w-0 flex-1 rounded-sm border border-border bg-bg-inset px-2 py-1 text-[15px] text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => !archived && setEditing(true)}
          disabled={archived || pending}
          className="min-w-0 flex-1 truncate text-left text-[15px] text-fg1 disabled:cursor-default"
        >
          {value}
        </button>
      )}

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
              {!archived && !isProtected && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditing(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                >
                  <Edit3 className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Renomear
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
    </div>
  );
}
