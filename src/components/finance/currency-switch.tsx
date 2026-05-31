'use client';

import { createContext, useContext, useTransition, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type CurrencySwitchValue = {
  switching: boolean;
  run: (action: () => Promise<void> | void) => void;
};

// Default sem provider: roda a ação direto (sem transição). Em produção o
// toggle vive sempre dentro do provider no layout do (app).
const CurrencySwitchContext = createContext<CurrencySwitchValue>({
  switching: false,
  run: (action) => {
    void action();
  },
});

export function useCurrencySwitch(): CurrencySwitchValue {
  return useContext(CurrencySwitchContext);
}

/**
 * Transição compartilhada da troca de moeda. Enquanto a server action +
 * revalidação dos valores (server components) não terminam, `switching` fica
 * true: o conteúdo esmaece e trava cliques, e uma pílula sinaliza o load. O
 * dim some exatamente quando os valores novos renderizam.
 */
export function CurrencySwitchProvider({ children }: { children: ReactNode }) {
  const [switching, startTransition] = useTransition();
  const run = (action: () => Promise<void> | void) => {
    startTransition(async () => {
      await action();
    });
  };

  return (
    <CurrencySwitchContext.Provider value={{ switching, run }}>
      <div
        aria-busy={switching}
        className={cn(
          'transition-opacity duration-200',
          switching && 'pointer-events-none select-none opacity-50',
        )}
      >
        {children}
      </div>
      {switching && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-16 z-40 -translate-x-1/2 lg:top-6"
        >
          <span className="inline-flex items-center gap-2 rounded-md border border-border-soft bg-bg-surface px-3 py-1.5 text-[12px] font-medium text-fg2 shadow-sm">
            <Loader2 className="size-3.5 animate-spin text-brand" strokeWidth={1.6} aria-hidden />
            Atualizando moeda…
          </span>
        </div>
      )}
    </CurrencySwitchContext.Provider>
  );
}
