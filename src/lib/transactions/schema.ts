import { z } from 'zod';

const MAX_DESCRIPTION_LENGTH = 200;
const MS_PER_DAY = 86_400_000;
const MAX_FUTURE_DAYS = 366;

// Aceita só YYYY-MM-DD e exige que a string ISO recriada bata (rejeita
// 2026-13-40 e similares). Não restringe ao passado: o usuário pode lançar
// despesa com data futura próxima (boleto a vencer), mas não > ~1 ano.
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
  paid: z.boolean().default(false),
  date: isoDate,
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type CreateTransactionParsed = z.output<typeof createTransactionSchema>;
