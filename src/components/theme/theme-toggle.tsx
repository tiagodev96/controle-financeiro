'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, MonitorSmartphone } from 'lucide-react';
import { THEME_COOKIE, type Theme } from '@/lib/theme/cookie';

type Props = {
  initialTheme: Theme;
};

const ORDER: Theme[] = ['dark', 'light', 'auto'];
const LABEL: Record<Theme, string> = {
  dark: 'Tema escuro (toque pra trocar)',
  light: 'Tema claro (toque pra trocar)',
  auto: 'Tema automático (toque pra trocar)',
};

export function ThemeToggle({ initialTheme }: Props) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function cycle() {
    const idx = ORDER.indexOf(theme);
    const next = ORDER[(idx + 1) % ORDER.length] ?? 'dark';
    setTheme(next);
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : MonitorSmartphone;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={LABEL[theme]}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-fg3 transition-colors hover:bg-bg-raised hover:text-fg1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}
