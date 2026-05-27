import { cn } from '@/lib/utils';

type Props = {
  eyebrow?: string;
  title: string;
  trailing?: React.ReactNode;
  className?: string;
};

/**
 * AppTopBar — banner editorial: eyebrow ("Maio · 2026", "3 em aberto",
 * "Nova despesa") + h1 + ações trailing opcionais (filtros, plus, etc).
 * Pattern fixo de cada screen do app.
 *
 * Layout: flex-wrap permite que, em viewport estreito, as ações trailing
 * caiam pra linha de baixo (full-width) em vez de comprimir o título — o
 * que antes forçava "Resumo do mês" a quebrar em duas linhas só pra dar
 * espaço pro toggle + month picker.
 */
export function AppTopBar({ eyebrow, title, trailing, className }: Props) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pb-2',
        className,
      )}
    >
      <div className="space-y-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {trailing && (
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {trailing}
        </div>
      )}
    </header>
  );
}
