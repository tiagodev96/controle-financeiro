'use client';

import { useState, useTransition } from 'react';
import { Edit3, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { MarkPaidButton } from './mark-paid-button';
import { deleteTransactionAction } from '@/server/actions/transactions/delete';

type Props = {
  transactionId: string;
  showMarkPaid: boolean;
  onEdit: () => void;
};

export function TxnRowMenu({ transactionId, showMarkPaid, onEdit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await deleteTransactionAction({ id: transactionId });
      if (!result.ok) toast.error(result.error);
      else toast.success('Lançamento removido.');
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {showMarkPaid && <MarkPaidButton transactionId={transactionId} />}

      <div className="relative">
        <button
          type="button"
          aria-label="Mais ações"
          disabled={pending}
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex size-8 items-center justify-center rounded-md text-fg3 transition-colors hover:bg-bg-raised hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
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
            <div className="absolute right-0 top-9 z-40 min-w-[180px] rounded-md border border-border-soft bg-bg-raised py-1 shadow-md">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
              >
                <Edit3 className="size-3.5" strokeWidth={1.6} aria-hidden />
                Editar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-money-negative hover:bg-bg-inset"
              >
                <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                Cancelar lançamento
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
