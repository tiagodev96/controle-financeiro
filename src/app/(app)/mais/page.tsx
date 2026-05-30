import Link from 'next/link';
import {
  Repeat,
  Tags,
  Wallet,
  Share2,
  CalendarRange,
  PiggyBank,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { AppTopBar } from '@/components/finance/app-top-bar';

type Item = {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
};

const items: Item[] = [
  { href: '/recorrentes', label: 'Recorrentes', description: 'Regras mensais', Icon: Repeat },
  { href: '/parcelados', label: 'Parcelados', description: 'Compras em N×', Icon: CalendarRange },
  { href: '/caixinhas', label: 'Caixinhas', description: 'Envelopes virtuais', Icon: PiggyBank },
  { href: '/reserva', label: 'Reserva', description: 'Saúde da reserva', Icon: ShieldCheck },
  { href: '/categorias', label: 'Categorias', description: 'Cadastro', Icon: Tags },
  { href: '/contas', label: 'Contas', description: 'Cadastro', Icon: Wallet },
  { href: '/resumo', label: 'Resumo', description: 'Exportar o mês', Icon: Share2 },
];

export default function MaisPage() {
  return (
    <section className="space-y-5">
      <AppTopBar eyebrow="Configuração" title="Mais" />

      <ul className="grid grid-cols-2 gap-2">
        {items.map(({ href, label, description, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col gap-2 rounded-md border border-border-soft bg-bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-5 text-fg3" strokeWidth={1.6} aria-hidden />
              <div>
                <p className="text-[15px] font-medium text-fg1">{label}</p>
                <p className="mono text-[10px] text-fg4">{description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
