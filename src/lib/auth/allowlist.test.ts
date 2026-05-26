import { describe, it, expect } from 'vitest';
import { parseAllowlist, isEmailAllowed } from './allowlist';

describe('parseAllowlist', () => {
  it('U-A1.1 — csv normal vira array trimmed e lowercased', () => {
    expect(parseAllowlist('a@x.com,b@y.com')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('U-A1.2 — espaços extras são trimados', () => {
    expect(parseAllowlist('  a@x.com  ,  b@y.com  ')).toEqual([
      'a@x.com',
      'b@y.com',
    ]);
  });

  it('U-A1.3 — entradas vazias entre vírgulas são descartadas', () => {
    expect(parseAllowlist('a@x.com,,b@y.com,')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('U-A1.4 — string vazia retorna []', () => {
    expect(parseAllowlist('')).toEqual([]);
  });

  it('U-A1.5 — undefined retorna []', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
  });

  it('U-A1.6 — capitalização do input é normalizada pra lowercase', () => {
    expect(parseAllowlist('Owner@Example.com')).toEqual(['owner@example.com']);
  });
});

describe('isEmailAllowed', () => {
  const list = ['owner@example.com', 'member@example.com'];

  it('U-A2.1 — email presente, mesma capitalização → true', () => {
    expect(isEmailAllowed('owner@example.com', list)).toBe(true);
  });

  it('U-A2.2 — email presente, capitalização diferente → true', () => {
    expect(isEmailAllowed('OWNER@example.com', list)).toBe(true);
  });

  it('U-A2.3 — espaços extras no input ainda matcham', () => {
    expect(isEmailAllowed('  owner@example.com  ', list)).toBe(true);
  });

  it('U-A2.4 — email ausente → false', () => {
    expect(isEmailAllowed('outsider@example.com', list)).toBe(false);
  });

  it('U-A2.5 — lista vazia → false sempre', () => {
    expect(isEmailAllowed('owner@example.com', [])).toBe(false);
  });

  it('U-A2.6 — string vazia → false', () => {
    expect(isEmailAllowed('', list)).toBe(false);
  });
});
