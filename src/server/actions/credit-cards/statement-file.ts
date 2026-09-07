import * as office from 'officecrypto-tool';
import ExcelJS from 'exceljs';
import {
  parseBtgStatement,
  type ParseStatementResult,
  type StatementSheet,
} from '@/lib/finance/btg-statement';

const WRONG_PASSWORD = 'Senha incorreta ou arquivo corrompido.';
const INVALID_FILE = 'Arquivo inválido — exporte a fatura em .xlsx no app do banco.';

/**
 * Decripta (CDFV2, senha padrão das faturas) e lê o xlsx, entregando a matriz
 * de células pro parser puro. Camada fina: toda a inteligência de formato
 * vive em src/lib/finance/btg-statement.ts.
 */
export async function readBtgStatementFile(
  buffer: Buffer,
  password: string,
): Promise<ParseStatementResult> {
  let decrypted: Buffer = buffer;
  try {
    if (office.isEncrypted(buffer)) {
      decrypted = await office.decrypt(buffer, { password });
    }
  } catch {
    return { ok: false, error: WRONG_PASSWORD };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(decrypted as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: INVALID_FILE };
  }

  const sheets: StatementSheet[] = workbook.worksheets.map((ws) => {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      rows.push([...(row.values as unknown[])]);
    });
    return { name: ws.name, rows };
  });

  return parseBtgStatement(sheets);
}
