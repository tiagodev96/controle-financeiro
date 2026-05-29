'use client';

import { createContext, useContext, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type BalanceVisibility = {
  hidden: boolean;
  toggle: () => void;
};

// Default visível: componentes de número fora do dashboard (sem provider)
// renderizam normalmente.
const BalanceVisibilityContext = createContext<BalanceVisibility>({
  hidden: false,
  toggle: () => {},
});

export function useBalanceVisibility(): BalanceVisibility {
  return useContext(BalanceVisibilityContext);
}

/**
 * Inicia sempre escondido a cada montagem (sem persistência): o objetivo é não
 * revelar o saldo ao abrir o dashboard em público. Revelar é uma ação ativa e
 * temporária.
 */
export function BalanceVisibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(true);
  return (
    <BalanceVisibilityContext.Provider
      value={{ hidden, toggle: () => setHidden((h) => !h) }}
    >
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function BalanceVisibilityToggle() {
  const { hidden, toggle } = useBalanceVisibility();
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!hidden}
      aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'}
      title={hidden ? 'Mostrar valores' : 'Esconder valores'}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border-soft bg-bg-inset text-fg2 transition-colors hover:border-border-strong hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <Icon className="size-4" strokeWidth={1.6} aria-hidden />
    </button>
  );
}
