import { MONTHS_PT } from '@/lib/dates';

/**
 * Parser puro da fatura exportada pelo BTG (xlsx já decriptado e lido —
 * a matriz chega como o exceljs entrega: values 1-indexados por coluna).
 * Ancora nos TÍTULOS das colunas, não em posições fixas: se o banco
 * embaralhar o layout, o parse falha com erro claro em vez de importar lixo.
 */

export type StatementSheet = {
  name: string;
  rows: unknown[][];
};

export type ParsedPurchase = {
  purchasedOn: string;
  description: string;
  amountCents: number;
  /** Código de autorização; parcela ganha sufixo #n/m (o código repete todo mês). */
  externalRef: string;
  kind: 'avista' | 'internacional' | 'parcela';
  cardLast4: string | null;
};

export type ParsedStatement = {
  dueOn: string;
  monthLabel: string;
  purchases: ParsedPurchase[];
  /** Linhas da tabela de compras descartadas: negativas ou de tipo desconhecido. */
  ignoredCount: number;
  /** "Total de compras e despesas" do arquivo, pra conferência. */
  statementTotalCents: number | null;
};

export type ParseStatementResult =
  | { ok: true; statement: ParsedStatement }
  | { ok: false; error: string };

const KIND_BY_TIPO: Record<string, ParsedPurchase['kind']> = {
  'Compra à vista': 'avista',
  'Compra internacional': 'internacional',
  'Parcela sem juros': 'parcela',
};

const MONTH_LABEL_RE = /^([a-zçã]+)\/(\d{4})$/i;
const DUE_LABEL_RE = /^(\d{2})\/(\d{2})$/;
const INSTALLMENT_RE = /\((\d+)\/(\d+)\)\s*$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return null;
}

function findCell(rows: unknown[][], label: string): { row: number; col: number } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const v = asTrimmedString(row[c]);
      if (v === label) return { row: r, col: c };
    }
  }
  return null;
}

function findNumberInRow(row: unknown[]): number | null {
  for (const cell of row) {
    if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
  }
  return null;
}

/** Ano do vencimento a partir do "Mês/Ano" do cabeçalho, com wrap de virada de ano. */
function resolveDueYear(dueMonth: number, headerMonth: number, headerYear: number): number {
  if (dueMonth < headerMonth - 6) return headerYear + 1;
  if (dueMonth > headerMonth + 6) return headerYear - 1;
  return headerYear;
}

export function parseBtgStatement(sheets: StatementSheet[]): ParseStatementResult {
  const allRows = sheets.flatMap((s) => s.rows);

  // Cabeçalho "Mês/AAAA" — em qualquer célula (fica mesclado ao lado do título).
  let monthLabel: string | null = null;
  let headerMonth = 0;
  let headerYear = 0;
  outer: for (const row of allRows) {
    for (const cell of row) {
      const v = asTrimmedString(cell);
      const match = v ? MONTH_LABEL_RE.exec(v) : null;
      if (!match) continue;
      const idx = MONTHS_PT.findIndex((m) => m === match[1]!.toLowerCase());
      if (idx === -1) continue;
      monthLabel = v!;
      headerMonth = idx + 1;
      headerYear = Number(match[2]);
      break outer;
    }
  }

  const dueCell = findCell(allRows, 'Vencimento');
  const dueLabel = dueCell
    ? (allRows[dueCell.row] ?? []).map(asTrimmedString).find((v) => v && DUE_LABEL_RE.test(v))
    : null;
  if (!monthLabel || !dueLabel) {
    return { ok: false, error: 'Formato não reconhecido: vencimento ou mês da fatura não encontrados.' };
  }
  const [, dd, mm] = DUE_LABEL_RE.exec(dueLabel)!;
  const dueMonth = Number(mm);
  const dueOn = `${resolveDueYear(dueMonth, headerMonth, headerYear)}-${pad2(dueMonth)}-${dd}`;

  const totalCell = findCell(allRows, 'Total de compras e despesas');
  const totalValue = totalCell ? findNumberInRow(allRows[totalCell.row] ?? []) : null;
  const statementTotalCents = totalValue === null ? null : Math.round(totalValue * 100);

  const purchases: ParsedPurchase[] = [];
  let ignoredCount = 0;
  let foundTable = false;

  for (const { rows } of sheets) {
    // Cabeçalho da tabela de compras: precisa ter "Data" E "Tipo de compra" —
    // isso exclui a tabela de pagamentos (que não tem tipo).
    for (let r = 0; r < rows.length; r++) {
      const header = rows[r] ?? [];
      const labels = header.map(asTrimmedString);
      const colDate = labels.indexOf('Data');
      const colTipo = labels.indexOf('Tipo de compra');
      if (colDate === -1 || colTipo === -1) continue;
      const colDesc = labels.indexOf('Descrição');
      const colValor = labels.indexOf('Valor');
      const colAuth = labels.indexOf('Código de autorização');
      const colLast4 = labels.indexOf('Final Cartão');
      if (colDesc === -1 || colValor === -1 || colAuth === -1) continue;
      foundTable = true;

      for (let i = r + 1; i < rows.length; i++) {
        const row = rows[i] ?? [];
        const purchasedOn = asIsoDate(row[colDate]);
        if (!purchasedOn) {
          // Linha sem data encerra a seção (rodapé/nova seção); segue procurando
          // outro cabeçalho a partir dela.
          if (row.some((c) => asTrimmedString(c) !== null)) break;
          continue;
        }
        const valor = row[colValor];
        const tipo = asTrimmedString(row[colTipo]);
        const auth = asTrimmedString(row[colAuth]);
        const description = (asTrimmedString(row[colDesc]) ?? '').replace(/\s+/g, ' ').slice(0, 200);
        const kind = tipo ? KIND_BY_TIPO[tipo] : undefined;

        if (typeof valor !== 'number' || !Number.isFinite(valor) || !auth || !description || !kind || valor <= 0) {
          ignoredCount += 1;
          continue;
        }

        const installment = INSTALLMENT_RE.exec(description);
        purchases.push({
          purchasedOn,
          description,
          amountCents: Math.round(valor * 100),
          externalRef: installment ? `${auth}#${installment[1]}/${installment[2]}` : auth,
          kind,
          cardLast4: asTrimmedString(row[colLast4]) ?? null,
        });
      }
    }
  }

  if (!foundTable) {
    return { ok: false, error: 'Formato não reconhecido: tabela de compras não encontrada.' };
  }

  return {
    ok: true,
    statement: { dueOn, monthLabel, purchases, ignoredCount, statementTotalCents },
  };
}
