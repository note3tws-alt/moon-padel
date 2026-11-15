import ExcelJS from "exceljs";
import Papa from "papaparse";

export const MAX_IMPORT_ROWS = 5000;

export interface ParsedSheet { headers: string[]; rows: Record<string, string>[]; sheetName?: string; truncated: boolean }

function cellToString(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    // Excel time-only values are dates on 1899-12-30.
    if (v.getUTCFullYear() <= 1900) return `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
    const iso = v.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink
    if ("result" in v) return cellToString(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(v);
}

export async function parseSpreadsheet(buf: ArrayBuffer, fileName: string): Promise<ParsedSheet> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");
    const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
    if (res.errors.length && !res.data.length) throw new Error(`Could not read the CSV: ${res.errors[0].message}`);
    const headers = (res.meta.fields ?? []).filter(Boolean);
    const rows = res.data.map((r) => Object.fromEntries(headers.map((h) => [h, (r[h] ?? "").toString().trim()])));
    return { headers, rows: rows.slice(0, MAX_IMPORT_ROWS), truncated: rows.length > MAX_IMPORT_ROWS };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    // First sheet that has data; skips an "Instructions" sheet in our templates.
    const ws = wb.worksheets.find((s) => s.actualRowCount > 1 && !/^instructions$/i.test(s.name)) ?? wb.worksheets[0];
    if (!ws) throw new Error("The workbook has no sheets.");
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    const cols: number[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = cellToString(cell.value).trim();
      if (h) { headers.push(h); cols.push(col); }
    });
    if (!headers.length) throw new Error("The first row must contain column headers.");
    const rows: Record<string, string>[] = [];
    let total = 0;
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      const rec: Record<string, string> = {};
      let any = false;
      cols.forEach((c, i) => {
        const val = cellToString(row.getCell(c).value).trim();
        rec[headers[i]] = val;
        if (val) any = true;
      });
      if (!any) return;
      total++;
      if (rows.length < MAX_IMPORT_ROWS) rows.push(rec);
    });
    return { headers, rows, sheetName: ws.name, truncated: total > MAX_IMPORT_ROWS };
  }
  if (lower.endsWith(".xls")) throw new Error("Old .xls files are not supported. Save the file as .xlsx or .csv and upload again.");
  throw new Error("Upload an Excel (.xlsx) or CSV file.");
}
