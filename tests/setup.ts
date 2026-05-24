import '@testing-library/jest-dom/vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carrega .env.local pra testes que tocam Supabase local (integração).
// Implementação manual leve — @next/env não populou em ambiente Vitest+jsdom.
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
