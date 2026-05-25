import Link from 'next/link';
import {
  Repeat,
  Tags,
  Wallet,
  Share2,
  type LucideIcon,
} from 'lucide-react';

type Item = {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
};

const items: Item[] = [
  { href: '/recorrentes', label: 'Recorrentes', description: 'Regras mensais', Icon: Repeat },
  { href: '/categorias', label: 'Categorias', description: 'Cadastro', Icon: Tags },
  { href: '/contas', label: 'Contas', description: 'Cadastro', Icon: Wallet },
  { href: '/resumo', label: 'Resumo', description: 'Exportar semana', Icon: Share2 },
];

export default function MaisPage() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="eyebrow">Mais</p>
        <h1>Configuração</h1>
      </header>

      <ul className="grid grid-cols-2 gap-2">
        {items.map(({ href, label, description, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col gap-2 rounded-md border border-border bg-bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-5 text-fg3" strokeWidth={1.6} aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-fg1">{label}</p>
                <p className="caption">{description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
