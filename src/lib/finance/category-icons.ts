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
  Wallet,
  Plane,
  Coffee,
  Dumbbell,
  Gift,
  Smartphone,
  Zap,
  Camera,
  type LucideIcon,
} from 'lucide-react';

/**
 * Curated set: chave estável usada em categories.icon (string),
 * componente Lucide pra renderização. Mantém o conjunto pequeno pra
 * caber num grid 4×N sem virar bagunça.
 */
export const ICON_CHOICES: { key: string; Icon: LucideIcon; label: string }[] = [
  { key: 'home', Icon: Home, label: 'Casa' },
  { key: 'utensils', Icon: UtensilsCrossed, label: 'Mercado' },
  { key: 'paw', Icon: PawPrint, label: 'Pet' },
  { key: 'heart', Icon: Heart, label: 'Saúde' },
  { key: 'tv', Icon: Tv, label: 'Lazer' },
  { key: 'car', Icon: Car, label: 'Transporte' },
  { key: 'briefcase', Icon: Briefcase, label: 'Trabalho' },
  { key: 'wallet', Icon: Wallet, label: 'Carteira' },
  { key: 'plane', Icon: Plane, label: 'Viagem' },
  { key: 'coffee', Icon: Coffee, label: 'Café' },
  { key: 'dumbbell', Icon: Dumbbell, label: 'Esporte' },
  { key: 'gift', Icon: Gift, label: 'Presente' },
  { key: 'smartphone', Icon: Smartphone, label: 'Tech' },
  { key: 'zap', Icon: Zap, label: 'Energia' },
  { key: 'camera', Icon: Camera, label: 'Foto' },
  { key: 'graduation', Icon: GraduationCap, label: 'Educação' },
  { key: 'shopping', Icon: ShoppingCart, label: 'Compras' },
  { key: 'receipt', Icon: Receipt, label: 'Contas' },
  { key: 'tag', Icon: Tag, label: 'Outros' },
];

const ICON_BY_KEY = new Map(ICON_CHOICES.map((c) => [c.key, c.Icon]));

/**
 * Heurística por nome (fallback quando o usuário não escolheu ícone manual).
 */
const RULES: { match: RegExp; Icon: LucideIcon }[] = [
  { match: /moradia|casa|aluguel|condom/i, Icon: Home },
  { match: /mercado|supermerc|comida|alimenta|restaur|padaria|caf[ée]/i, Icon: UtensilsCrossed },
  { match: /pet|cachorro|gato|animal/i, Icon: PawPrint },
  { match: /saude|sa[úu]de|farm[áa]cia|hospital|m[ée]dic/i, Icon: Heart },
  { match: /lazer|cinema|streaming|entretenimento|hobby/i, Icon: Tv },
  { match: /transp|uber|t[áa]xi|gasolina|carro/i, Icon: Car },
  { match: /trabalho|escrit[óo]rio|coworking|sal[áa]rio/i, Icon: Briefcase },
  { match: /educa[çc][ãa]o|escola|curso|livro/i, Icon: GraduationCap },
  { match: /viagem|passagem|voo/i, Icon: Plane },
  { match: /esporte|gin[áa]sio|academia/i, Icon: Dumbbell },
  { match: /presente|gift|amigo secreto/i, Icon: Gift },
  { match: /celular|telefone|smartphone|adobe|capcut|netflix/i, Icon: Smartphone },
  { match: /luz|energia|el[ée]trica|conta de luz/i, Icon: Zap },
  { match: /foto|ensaio|c[âa]mera/i, Icon: Camera },
  { match: /reembolso|freelance/i, Icon: Wallet },
  { match: /compras|roupa/i, Icon: ShoppingCart },
  { match: /outros|conta|servi[çc]o|tarifa/i, Icon: Receipt },
];

export function iconForCategory(name: string): LucideIcon {
  for (const { match, Icon } of RULES) {
    if (match.test(name)) return Icon;
  }
  return Tag;
}

/**
 * Resolve o ícone preferindo o que foi explicitamente escolhido pelo usuário
 * (categories.icon). Cai na heurística por nome caso ausente ou inválido.
 */
export function resolveCategoryIcon(category: {
  name: string;
  icon?: string | null;
}): LucideIcon {
  if (category.icon) {
    const found = ICON_BY_KEY.get(category.icon);
    if (found) return found;
  }
  return iconForCategory(category.name);
}
