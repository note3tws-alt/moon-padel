import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { parseSpreadsheet } from "@/lib/import/parse";
import { FIELDS, suggestMapping, type ImportKind } from "@/lib/import/fields";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    const kind = String(fd.get("kind")) as ImportKind;
    if (!(kind in FIELDS)) return NextResponse.json({ error: "Unknown import type" }, { status: 400 });
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 8 MB" }, { status: 400 });
    const sheet = await parseSpreadsheet(await file.arrayBuffer(), file.name);
    if (!sheet.rows.length) return NextResponse.json({ error: "The file has headers but no data rows" }, { status: 400 });
    return NextResponse.json({ fileName: file.name, ...sheet, mapping: suggestMapping(kind, sheet.headers) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not read the file" }, { status: 400 });
  }
}
