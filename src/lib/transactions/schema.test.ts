import { describe, it, expect } from 'vitest';
import { createTransactionSchema } from './schema';

// Data dinâmica em vez de hardcoded: o schema rejeita data > 1 ano no futuro
// usando Date.now(), então uma constante fixa quebraria o teste em ~1 ano.
const TODAY = new Date().toISOString().slice(0, 10);

const validInput = {
  amountCents: 1250,
  description: 'Pão na padaria',
  categoryId: '33333333-3333-4333-8333-333333333001',
  accountId: '22222222-2222-4222-8222-222222222001',
  paid: false,
  date: TODAY,
};

describe('createTransactionSchema', () => {
  describe('happy path', () => {
    it('aceita input válido', () => {
      const result = createTransactionSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('aplica default false em paid quando omitido', () => {
      const { paid: _ignore, ...withoutPaid } = validInput;
      const result = createTransactionSchema.safeParse(withoutPaid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paid).toBe(false);
      }
    });

    it('faz trim de espaços na descrição', () => {
      const result = createTransactionSchema.safeParse({
        ...validInput,
        description: '  Pão  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Pão');
      }
    });
  });

  describe('amountCents', () => {
    it('rejeita 0', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, amountCents: 0 });
      expect(result.success).toBe(false);
    });

    it('rejeita negativo', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, amountCents: -100 });
      expect(result.success).toBe(false);
    });

    it('rejeita não-inteiro (12.50 em vez de 1250 centavos)', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, amountCents: 12.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('description', () => {
    it('rejeita string vazia', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, description: '' });
      expect(result.success).toBe(false);
    });

    it('rejeita string só com espaços (após trim fica vazia)', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, description: '   ' });
      expect(result.success).toBe(false);
    });

    it('rejeita > 200 caracteres', () => {
      const result = createTransactionSchema.safeParse({
        ...validInput,
        description: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('categoryId / accountId', () => {
    it('rejeita categoryId inválido (não UUID)', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, categoryId: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejeita accountId inválido (não UUID)', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, accountId: 'xyz' });
      expect(result.success).toBe(false);
    });
  });

  describe('date', () => {
    it('rejeita formato fora de YYYY-MM-DD', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, date: '24/05/2026' });
      expect(result.success).toBe(false);
    });

    it('rejeita data inválida (2026-13-40)', () => {
      const result = createTransactionSchema.safeParse({ ...validInput, date: '2026-13-40' });
      expect(result.success).toBe(false);
    });

    it('rejeita data mais de 1 ano no futuro', () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 2);
      const iso = farFuture.toISOString().slice(0, 10);
      const result = createTransactionSchema.safeParse({ ...validInput, date: iso });
      expect(result.success).toBe(false);
    });

    it('aceita data ontem', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const iso = yesterday.toISOString().slice(0, 10);
      const result = createTransactionSchema.safeParse({ ...validInput, date: iso });
      expect(result.success).toBe(true);
    });
  });
});
