import { z } from 'zod';

const MAX_DESCRIPTION_LENGTH = 200;
const MS_PER_DAY = 86_400_000;
const MAX_FUTURE_DAYS = 366;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Data inválida')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`).getTime();
    const limit = Date.now() + MAX_FUTURE_DAYS * MS_PER_DAY;
    return d <= limit;
  }, 'Data muito no futuro');

export const createTransactionSchema = z.object({
  amountCents: z
    .number()
    .int('Valor deve ser inteiro em centavos')
    .positive('Valor deve ser maior que zero'),
  description: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(1, 'Descrição é obrigatória')
        .max(MAX_DESCRIPTION_LENGTH, `Descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres`)
    ),
  categoryId: z.string().uuid('Categoria inválida'),
  accountId: z.string().uuid('Conta inválida'),
  direction: z.enum(['expense', 'income']).default('expense'),
  paid: z.boolean().default(false),
  /**
   * Quando true e paid também é true, atualiza accounts.balance_cents na hora
   * (despesa subtrai, entrada soma). Quando false, transaction nasce paga mas
   * o saldo manual fica intacto — útil quando o saldo já foi atualizado fora
   * do app. Ignorado se paid=false.
   */
  updateBalance: z.boolean().default(true),
  date: isoDate,
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type CreateTransactionParsed = z.output<typeof createTransactionSchema>;
