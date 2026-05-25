import { describe, it, expect } from 'vitest';
import { parseMoneyString } from './parse';

describe('parseMoneyString', () => {
  describe('formatos válidos PT-BR', () => {
    it('converte "12,50" em 1250 centavos', () => {
      expect(parseMoneyString('12,50')).toBe(1250);
    });

    it('converte "0,50" em 50 centavos', () => {
      expect(parseMoneyString('0,50')).toBe(50);
    });

    it('converte "12" sem decimal em 1200 centavos', () => {
      expect(parseMoneyString('12')).toBe(1200);
    });

    it('converte "1.240,50" com separador de milhar em 124050 centavos', () => {
      expect(parseMoneyString('1.240,50')).toBe(124050);
    });

    it('converte "1.234.567,89" com múltiplos milhares', () => {
      expect(parseMoneyString('1.234.567,89')).toBe(123456789);
    });

    it('aceita espaços em volta', () => {
      expect(parseMoneyString('  12,50  ')).toBe(1250);
    });

    it('aceita 1 dígito decimal (pad com zero)', () => {
      expect(parseMoneyString('12,5')).toBe(1250);
    });

    it('aceita 0 explícito', () => {
      // Quem rejeita amount=0 é o schema Zod, não o parser.
      expect(parseMoneyString('0')).toBe(0);
    });
  });

  describe('formatos inválidos', () => {
    it('rejeita string vazia', () => {
      expect(() => parseMoneyString('')).toThrow();
    });

    it('rejeita apenas espaços', () => {
      expect(() => parseMoneyString('   ')).toThrow();
    });

    it('rejeita "abc"', () => {
      expect(() => parseMoneyString('abc')).toThrow();
    });

    it('rejeita valor negativo "-12"', () => {
      expect(() => parseMoneyString('-12')).toThrow();
    });

    it('rejeita "12.50" (ponto como decimal, PT-BR estrito)', () => {
      expect(() => parseMoneyString('12.50')).toThrow();
    });

    it('rejeita "12,50,30" (múltiplas vírgulas)', () => {
      expect(() => parseMoneyString('12,50,30')).toThrow();
    });

    it('rejeita "12,500" (3 dígitos decimais)', () => {
      expect(() => parseMoneyString('12,500')).toThrow();
    });

    it('rejeita "1.24,50" (separador de milhar com menos de 3 dígitos)', () => {
      expect(() => parseMoneyString('1.24,50')).toThrow();
    });
  });
});
