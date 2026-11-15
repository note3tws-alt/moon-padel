import { PageHeader } from "@/components/admin/page-header";
import { ImportWizard } from "@/components/admin/import-wizard";
import { sql } from "@/lib/db";
import { FIELDS, type ImportKind } from "@/lib/import/fields";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Upload data" };

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const initial = (kind && kind in FIELDS ? kind : "players") as ImportKind;
  const logs = await sql()`select l.*, u.email from import_logs l left join users u on u.id = l.created_by order by l.created_at desc limit 15`;
  return (
    <>
      <PageHeader title="Upload data" description="Upload an Excel or CSV file, map its columns, check every row, then confirm. Nothing is saved until you confirm, and imports never overwrite data silently." />
      <ImportWizard initialKind={initial} />
      <section className="card mt-8 p-5">
        <h2 className="mb-3 font-bold">Import history</h2>
        {logs.length ? (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>When</th><th>Type</th><th>File</th><th>Mode</th><th className="text-right">New</th><th className="text-right">Updated</th><th className="text-right">Skipped</th><th className="text-right">Failed</th><th>By</th><th></th></tr></thead>
              <tbody>{logs.map((l) => (
                <tr key={l.id}>
                  <td className="text-muted">{fmtDate(l.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{l.kind}</td><td className="text-xs text-muted">{l.filename ?? "–"}</td><td className="text-xs">{l.mode === "update" ? "Update + add" : "Add new only"}</td>
                  <td className="text-right">{l.inserted}</td><td className="text-right">{l.updated}</td><td className="text-right">{l.skipped}</td>
                  <td className="text-right">{l.failed ? <span className="text-[#f2a08c]">{l.failed}</span> : 0}</td>
                  <td className="text-xs text-muted">{l.email ?? "–"}</td>
                  <td>{l.failed > 0 && <a className="text-xs text-ice" href={`/api/admin/import/${l.id}/failed`}>Failed rows</a>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">No imports yet.</p>}
      </section>
    </>
  );
}
