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
 */
export function AppTopBar({ eyebrow, title, trailing, className }: Props) {
  return (
    <header className={cn('flex items-end justify-between gap-3 pb-2', className)}>
      <div className="space-y-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
    </header>
  );
}
