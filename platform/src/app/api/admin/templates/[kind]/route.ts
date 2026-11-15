import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { getAdmin } from "@/lib/auth";
import { FIELDS, IMPORT_KINDS, type ImportKind } from "@/lib/import/fields";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const { kind } = await params;
  if (!(kind in FIELDS)) return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  const fields = FIELDS[kind as ImportKind];
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const name = `moonpadel-${kind}-template`;

  if (format === "csv") {
    const csv = Papa.unparse({ fields: fields.map((f) => f.label), data: [fields.map((f) => f.example)] });
    return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "MoonPadel";
  const ws = wb.addWorksheet(IMPORT_KINDS.find((k) => k.kind === kind)!.label);
  ws.columns = fields.map((f) => ({ header: f.label, key: f.key, width: Math.max(14, f.label.length + 4) }));
  ws.addRow(Object.fromEntries(fields.map((f) => [f.key, f.example])));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFE9EEF5" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1428" } };
  fields.forEach((f, i) => { if (f.required) ws.getCell(1, i + 1).font = { bold: true, color: { argb: "FFA9DBFF" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  // Text format for ID / date columns so Excel does not mangle them.
  fields.forEach((f, i) => { if (/code|date|player|month|time|phone/.test(f.key)) ws.getColumn(i + 1).numFmt = "@"; });

  const info = wb.addWorksheet("Instructions");
  info.columns = [{ header: "Column", key: "c", width: 28 }, { header: "Required", key: "r", width: 10 }, { header: "Notes", key: "n", width: 80 }];
  info.getRow(1).font = { bold: true };
  fields.forEach((f) => info.addRow({ c: f.label, r: f.required ? "Yes" : "", n: f.hint ?? "" }));
  info.addRow({});
  info.addRow({ c: "Tips", n: "Keep the header row. Delete the example row before uploading. Column names can differ: you map them during upload." });

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}.xlsx"` } });
}
