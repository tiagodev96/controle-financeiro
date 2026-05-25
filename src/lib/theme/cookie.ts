export type Theme = 'light' | 'dark' | 'auto';

export const THEME_COOKIE = 'cf_theme';

export function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark' || v === 'auto';
}

export function resolveTheme(cookieValue: string | undefined): Theme {
  return isTheme(cookieValue) ? cookieValue : 'dark';
}
