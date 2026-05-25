import {
  Home,
  UtensilsCrossed,
  PawPrint,
  Heart,
  Tv,
  Car,
  Briefcase,
  GraduationCap,
  ShoppingCart,
  Receipt,
  Tag,
  type LucideIcon,
} from 'lucide-react';

/**
 * Mapeia nomes de categoria livres do usuário pra ícones Lucide.
 * Match case-insensitive por substring; cai em `Tag` (genérico) quando
 * nenhum bate. O design system sugere esses mapeamentos.
 */
const RULES: { match: RegExp; Icon: LucideIcon }[] = [
  { match: /moradia|casa|aluguel|condom/i, Icon: Home },
  { match: /mercado|supermerc|comida|alimenta|restaur|padaria|caf[ée]/i, Icon: UtensilsCrossed },
  { match: /pet|cachorro|gato|animal/i, Icon: PawPrint },
  { match: /saude|sa[úu]de|farm[áa]cia|hospital|m[ée]dic/i, Icon: Heart },
  { match: /lazer|cinema|streaming|entretenimento|hobby/i, Icon: Tv },
  { match: /transp|uber|t[áa]xi|gasolina|carro/i, Icon: Car },
  { match: /trabalho|escrit[óo]rio|coworking/i, Icon: Briefcase },
  { match: /educa[çc][ãa]o|escola|curso|livro/i, Icon: GraduationCap },
  { match: /compras|roupa|presente/i, Icon: ShoppingCart },
  { match: /outros|conta|servi[çc]o|tarifa/i, Icon: Receipt },
];

export function iconForCategory(name: string): LucideIcon {
  for (const { match, Icon } of RULES) {
    if (match.test(name)) return Icon;
  }
  return Tag;
}
