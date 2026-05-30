'use client';

import { useState, useTransition } from 'react';
import { Edit3, Lock, MinusCircle, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Num, type Currency } from '@/components/finance/num';
import { deleteEnvelopeAction } from '@/server/actions/envelopes/actions';
import { EditEnvelopeDialog } from './edit-dialog';
import { MoveEnvelopeDialog } from './move-dialog';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  name: string;
  currency: Currency;
  currentCents: number;
  targetCents: number | null;
  isReserve?: boolean;
};

export function EnvelopeListItem({
  id,
  name,
  currency,
  currentCents,
  targetCents,
  isReserve = false,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [moveMode, setMoveMode] = useState<'allocate' | 'withdraw' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasTarget = targetCents != null && targetCents > 0;
  const pct = hasTarget ? Math.min(currentCents / targetCents, 1) : 0;
  const pctLabel = hasTarget ? Math.round(pct * 100) : 0;
  const filled = hasTarget && currentCents >= targetCents;

  function handleDelete() {
    setMenuOpen(false);
    if (currentCents > 0) {
      if (!confirm(`A caixinha tem valor alocado. Excluir devolve pro saldo livre?`)) return;
    }
    startTransition(async () => {
      const result = await deleteEnvelopeAction({ envelopeId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Caixinha excluída.');
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-border-soft bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-medium text-fg1">{name}</p>
            {isReserve && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-bg-inset px-1.5 py-0.5 mono text-[10px] uppercase tracking-wider text-fg4">
                <Lock className="size-2.5" strokeWidth={1.6} aria-hidden />
                reserva
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 text-[12px] text-fg3">
            <Num cents={currentCents} currency={currency} className="font-semibold text-fg2" />
            {hasTarget && (
              <>
                <span className="text-fg5">·</span>
                <span>
                  meta <Num cents={targetCents} currency={currency} className="text-fg3" />
                </span>
                <span className="mono text-[10px] text-fg4">{pctLabel}%</span>
              </>
            )}
          </div>
        </div>

        {!isReserve && (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={`Ações para ${name}`}
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
              <div className="absolute right-0 top-9 z-40 min-w-40 rounded-md border border-border-soft bg-bg-raised py-1 shadow-md">
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
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-money-negative hover:bg-bg-inset"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.6} aria-hidden />
                  Excluir
                </button>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {hasTarget && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-bg-inset"
          role="progressbar"
          aria-valuenow={pctLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pctLabel}% da meta`}
        >
          <div
            className={cn('h-full transition-all', filled ? 'bg-money-positive' : 'bg-brand')}
            style={{ width: `${Math.max(pct * 100, currentCents > 0 ? 4 : 0)}%` }}
            aria-hidden
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMoveMode('allocate')}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-soft bg-bg-inset text-sm font-medium text-fg2 transition-colors hover:border-border-strong hover:text-fg1 disabled:opacity-60"
        >
          <PlusCircle className="size-3.5" strokeWidth={1.6} aria-hidden />
          Alocar
        </button>
        <button
          type="button"
          onClick={() => setMoveMode('withdraw')}
          disabled={pending || currentCents === 0}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-soft bg-bg-inset text-sm font-medium text-fg2 transition-colors hover:border-border-strong hover:text-fg1 disabled:opacity-60"
        >
          <MinusCircle className="size-3.5" strokeWidth={1.6} aria-hidden />
          Devolver
        </button>
      </div>

      {editOpen && (
        <EditEnvelopeDialog
          envelopeId={id}
          currentName={name}
          currentTargetCents={targetCents}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {moveMode !== null && (
        <MoveEnvelopeDialog
          envelopeId={id}
          envelopeName={name}
          currentCents={currentCents}
          currency={currency}
          mode={moveMode}
          open={moveMode !== null}
          onOpenChange={(next) => !next && setMoveMode(null)}
        />
      )}
    </div>
  );
}
