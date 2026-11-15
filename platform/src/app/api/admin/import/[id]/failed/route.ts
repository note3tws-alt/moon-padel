import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [log] = await sql()`select kind, filename, summary from import_logs where id = ${id}`;
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rows = (log.summary?.failedRows ?? []) as Record<string, string>[];
  const csv = Papa.unparse(rows.map(({ __row, __error, ...rest }) => ({ row: __row, error: __error, ...rest })));
  return new NextResponse("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="failed-rows-${log.kind}.csv"` } });
}
