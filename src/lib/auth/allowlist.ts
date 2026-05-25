export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string, allowlist: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return allowlist.includes(normalized);
}
