export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'cf_theme';

export function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark';
}

export function resolveTheme(cookieValue: string | undefined): Theme {
  return isTheme(cookieValue) ? cookieValue : 'dark';
}
