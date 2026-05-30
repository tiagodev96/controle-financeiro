'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setCategoryEssentialAction } from '@/server/actions/reserva/actions';
import { cn } from '@/lib/utils';

type CategoryOption = {
  id: string;
  name: string;
  isEssential: boolean;
};

type Props = {
  categories: CategoryOption[];
};

export function EssentialCategoriesEditor({ categories }: Props) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(categories.map((c) => [c.id, c.isEssential])),
  );
  const [pending, startTransition] = useTransition();

  function toggle(categoryId: string) {
    const next = !state[categoryId];
    setState((prev) => ({ ...prev, [categoryId]: next }));
    startTransition(async () => {
      const result = await setCategoryEssentialAction({ categoryId, isEssential: next });
      if (!result.ok) {
        setState((prev) => ({ ...prev, [categoryId]: !next }));
        toast.error(result.error);
      }
    });
  }

  if (categories.length === 0) {
    return (
      <p className="rounded-md border border-border-soft bg-bg-surface p-4 text-center text-sm text-fg3">
        Sem categorias de despesa pra marcar.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const on = state[c.id] ?? false;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            disabled={pending}
            onClick={() => toggle(c.id)}
            className={cn(
              'inline-flex min-h-9 items-center rounded-full border px-3 text-sm transition-colors disabled:opacity-60',
              on
                ? 'border-brand bg-brand/10 font-medium text-fg1'
                : 'border-border-soft bg-bg-surface text-fg3 hover:border-border-strong hover:text-fg2',
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
