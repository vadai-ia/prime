import "server-only";
import ExcelJS from "exceljs";

// Exportar a Excel (solo admin). Quien lo use tiene que haber llamado antes a assertPermission("export")
// y registrar log_audit('export'): este módulo solo arma el archivo.

export type Column<T> = { header: string; width?: number; value: (row: T) => string | number | null | undefined };

export async function toXlsx<T>(sheetName: string, columns: Column<T>[], rows: T[]): Promise<ArrayBuffer> {
  const book = new ExcelJS.Workbook();
  book.creator = "Prime HR";
  book.created = new Date();
  const sheet = book.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 18 }));
  for (const r of rows) sheet.addRow(columns.map((c) => c.value(r) ?? null));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4D3A" } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  const buffer = await book.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
