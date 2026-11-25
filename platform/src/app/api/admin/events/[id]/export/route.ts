import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAdmin } from "@/lib/auth";
import { eventReport } from "@/lib/ladder/report";

export const dynamic = "force-dynamic";

/** Event report: ?format=xlsx (all sheets) or ?format=csv&kind=totals|matches|audit. Admin only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "xlsx";
  const r = await eventReport(id);
  const base = `moonpadel-${r.bundle.event.slug}`;
  if (format === "csv") {
    const kind = (url.searchParams.get("kind") ?? "totals") as "totals" | "matches" | "audit";
    const csv = Papa.unparse(r[kind] as Record<string, unknown>[]);
    return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}-${kind}.csv"` } });
  }
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "MoonPadel";
  for (const [title, rows] of [["Totals", r.totals], ["Rounds", r.matches], ["Audit log", r.audit]] as const) {
    const ws = wb.addWorksheet(title);
    const list = rows as Record<string, unknown>[];
    if (!list.length) continue;
    ws.columns = Object.keys(list[0]).map((k) => ({ header: k, key: k, width: Math.max(10, Math.min(40, k.length + 6)) }));
    list.forEach((row) => ws.addRow(row));
    ws.getRow(1).font = { bold: true };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${base}.xlsx"` } });
}
