import { describe, it, expect } from 'vitest';
import { parseBtgStatement, type StatementSheet } from './btg-statement';

// Réplica fiel da estrutura do export BTG: values 1-indexados por coluna
// (como o exceljs entrega), com célula 0 sempre vazia.
function sheet(rows: unknown[][]): StatementSheet {
  return { name: 'Titular', rows };
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function btgRows({
  monthLabel = 'Setembro/2026',
  dueLabel = '11/09',
  purchases,
}: {
  monthLabel?: string;
  dueLabel?: string;
  purchases: unknown[][];
}): unknown[][] {
  return [
    [],
    [],
    [null, null, 'Fatura Cartão de Crédito', null, null, null, null, monthLabel],
    [],
    [null, null, 'Fatura Atual', null, null, null, 'Resumo'],
    [null, null, 'Período de Compras', null, '07/08 até 07/09', null, 'Lançamentos Nacionais', null, 7400.64],
    [null, null, 'Vencimento', null, dueLabel, null, 'Lançamentos Internacionais', null, 118.31],
    [null, null, 'Pagamento mínimo', null, 1127.84, null, 'Total da Fatura', null, 7518.95],
    [],
    [null, null, 'Pagamentos feitos pelo cliente ', null, null, -32.74],
    [null, null, 'Data', 'Descrição', '', 'Valor'],
    [null, null, d('2026-08-07'), 'Pagamento de fatura', null, -32.74],
    [],
    [null, null, 'Total de compras e despesas', null, null, 7518.95],
    [],
    [null, null, 'Data', 'Descrição', '', 'Valor', 'Tipo de compra', 'Código de autorização', 'Final Cartão'],
    ...purchases,
  ];
}

describe('parseBtgStatement', () => {
  it('U-BTG1 — extrai vencimento com ano do cabeçalho e as compras com colunas ancoradas por título', () => {
    const result = parseBtgStatement([
      sheet(
        btgRows({
          purchases: [
            [null, null, d('2026-08-06'), 'Mercado Livre', null, 67.99, 'Compra à vista', 'ZHIGHW', '1906'],
            [null, null, d('2026-08-10'), 'Chess', null, 39.18, 'Compra internacional', 'U61QUR', '7386'],
          ],
        }),
      ),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.statement;
    expect(s.dueOn).toBe('2026-09-11');
    expect(s.monthLabel).toBe('Setembro/2026');
    expect(s.statementTotalCents).toBe(751895);
    expect(s.purchases).toHaveLength(2);
    expect(s.purchases[0]).toEqual({
      purchasedOn: '2026-08-06',
      description: 'Mercado Livre',
      amountCents: 6799,
      externalRef: 'ZHIGHW',
      kind: 'avista',
      installment: null,
      cardLast4: '1906',
    });
    expect(s.purchases[1]!.kind).toBe('internacional');
    expect(s.ignoredCount).toBe(0);
  });

  it('U-BTG2 — parcela ganha sufixo #n/m no externalRef (o código repete nos meses seguintes)', () => {
    const result = parseBtgStatement([
      sheet(
        btgRows({
          purchases: [
            [null, null, d('2026-09-05'), 'Mercado Livre (1/10)', null, 58.9, 'Parcela sem juros', '0KNVYK', '1906'],
          ],
        }),
      ),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.statement.purchases[0]!;
    expect(p.kind).toBe('parcela');
    expect(p.externalRef).toBe('0KNVYK#1/10');
    expect(p.installment).toEqual({ number: 1, total: 10 });
    expect(p.amountCents).toBe(5890);
  });

  it('U-BTG3 — ignora (e conta) valores negativos e tipos desconhecidos', () => {
    const result = parseBtgStatement([
      sheet(
        btgRows({
          purchases: [
            [null, null, d('2026-08-09'), 'Estorno Loja X', null, -50.0, 'Compra à vista', 'AAAAAA', '1906'],
            [null, null, d('2026-08-09'), 'Saque emergência', null, 100.0, 'Saque no crédito', 'BBBBBB', '1906'],
            [null, null, d('2026-08-09'), 'Ifood', null, 8.97, 'Compra à vista', 'CCCCCC', '7386'],
          ],
        }),
      ),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statement.purchases).toHaveLength(1);
    expect(result.statement.purchases[0]!.externalRef).toBe('CCCCCC');
    expect(result.statement.ignoredCount).toBe(2);
  });

  it('U-BTG4 — virada de ano: fatura Dezembro/2026 vencendo 05/01 cai em 2027', () => {
    const result = parseBtgStatement([
      sheet(
        btgRows({
          monthLabel: 'Dezembro/2026',
          dueLabel: '05/01',
          purchases: [
            [null, null, d('2026-12-10'), 'Uber', null, 20.0, 'Compra à vista', 'DDDDDD', '7675'],
          ],
        }),
      ),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statement.dueOn).toBe('2027-01-05');
  });

  it('U-BTG5 — datas como string ISO (variação do leitor) também funcionam', () => {
    const result = parseBtgStatement([
      sheet(
        btgRows({
          purchases: [
            [null, null, '2026-08-06T00:00:00.000Z', 'Steam', null, 18.19, 'Compra à vista', 'BPKDA9', '7386'],
          ],
        }),
      ),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statement.purchases[0]!.purchasedOn).toBe('2026-08-06');
  });

  it('U-BTG6 — sem cabeçalho de compras ou sem vencimento retorna erro claro', () => {
    const noDue = parseBtgStatement([sheet([[null, null, 'Qualquer coisa']])]);
    expect(noDue.ok).toBe(false);
    if (!noDue.ok) expect(noDue.error).toMatch(/vencimento|formato/i);

    const noPurchases = parseBtgStatement([
      sheet([
        [null, null, 'Fatura Cartão de Crédito', null, null, null, null, 'Setembro/2026'],
        [null, null, 'Vencimento', null, '11/09'],
      ]),
    ]);
    expect(noPurchases.ok).toBe(false);
  });

  it('U-BTG7 — soma compras de múltiplas abas (titular + adicionais)', () => {
    const base = btgRows({
      purchases: [
        [null, null, d('2026-08-06'), 'Mercado Livre', null, 67.99, 'Compra à vista', 'ZHIGHW', '1906'],
      ],
    });
    const extra: StatementSheet = {
      name: 'Adicional',
      rows: [
        [null, null, 'Data', 'Descrição', '', 'Valor', 'Tipo de compra', 'Código de autorização', 'Final Cartão'],
        [null, null, d('2026-08-07'), 'Steam', null, 18.19, 'Compra à vista', 'BPKDA9', '7386'],
      ],
    };
    const result = parseBtgStatement([sheet(base), extra]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statement.purchases.map((p) => p.externalRef)).toEqual(['ZHIGHW', 'BPKDA9']);
  });

  it('U-BTG8 — arredondamento de centavos sem artefato de float', () => {
    const result = parseBtgStatement([
      sheet(
        btgRows({
          purchases: [
            [null, null, d('2026-08-08'), 'Zee Now', null, 108.98, 'Compra à vista', 'IWVKPV', '7386'],
            [null, null, d('2026-08-08'), 'Fotosystem', null, 7.0, 'Compra à vista', 'GC59VK', '1906'],
          ],
        }),
      ),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.statement.purchases.map((p) => p.amountCents)).toEqual([10898, 700]);
  });
});
