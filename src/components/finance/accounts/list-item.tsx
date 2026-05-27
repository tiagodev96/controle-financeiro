'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Archive, Coins, Edit3, History, MoreHorizontal, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  archiveAccountAction,
  renameAccountAction,
  unarchiveAccountAction,
} from '@/server/actions/accounts/actions';
import { CCY } from '@/components/finance/ccy';
import { Num, type Currency } from '@/components/finance/num';
import { EditBalanceDialog } from './edit-balance-dialog';
import { BalanceHistoryDialog } from './balance-history-dialog';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  name: string;
  currency: Currency;
  balanceCents: number;
  archived: boolean;
};

export function AccountListItem({ id, name, currency, balanceCents, archived }: Props) {
  const [editing, setEditing] = useState(false);
  // Derived state pattern: sincroniza com prop sem useEffect.
  const [prevName, setPrevName] = useState(name);
  const [value, setValue] = useState(name);
  if (name !== prevName) {
    setPrevName(name);
    setValue(name);
  }

  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
      const result = await renameAccountAction({ accountId: id, name: trimmed });
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
      const result = await archiveAccountAction({ accountId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Arquivada.');
    });
  }

  function handleUnarchive() {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await unarchiveAccountAction({ accountId: id });
      if (!result.ok) toast.error(result.error);
      else toast.success('Desarquivada.');
    });
  }

  return (
    <div className={cn('flex items-center gap-3 py-3', archived && 'opacity-60')}>
      <CCY code={currency} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
            className="min-w-0 rounded-sm border border-border bg-bg-inset px-2 py-1 text-[15px] text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => !archived && setEditing(true)}
            disabled={archived || pending}
            className="truncate text-left text-[15px] text-fg1 disabled:cursor-default"
          >
            {value}
          </button>
        )}
        {archived && balanceCents !== 0 && (
          <span className="mono text-[10px] text-fg4">
            arquivada com saldo
          </span>
        )}
      </div>

      <Num
        cents={balanceCents}
        currency={currency}
        className="shrink-0 text-[15px] font-semibold text-fg2"
      />

      <div className="relative shrink-0">
        <button
          type="button"
          aria-label={`Ações para ${name}`}
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex size-8 items-center justify-center rounded-md text-fg3 transition-colors hover:bg-bg-raised hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.6} aria-hidden />
        </button>
        {balanceOpen && (
          <EditBalanceDialog
            accountId={id}
            accountName={name}
            currency={currency}
            currentBalanceCents={balanceCents}
            open={balanceOpen}
            onOpenChange={setBalanceOpen}
          />
        )}
        {historyOpen && (
          <BalanceHistoryDialog
            accountId={id}
            accountName={name}
            currency={currency}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
          />
        )}
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div className="absolute right-0 top-9 z-40 min-w-[140px] rounded-md border border-border-soft bg-bg-raised py-1 shadow-md">
              {!archived && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setBalanceOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                  >
                    <Coins className="size-3.5" strokeWidth={1.6} aria-hidden />
                    Editar saldo
                  </button>
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
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setHistoryOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-fg1 hover:bg-bg-inset"
                  >
                    <History className="size-3.5" strokeWidth={1.6} aria-hidden />
                    Histórico
                  </button>
                </>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
