import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/ui";
import { sql } from "@/lib/db";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AuditAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = sql();
  const rows = await db`
    select *, count(*) over() as total from admin_audit_logs
    where true ${sp.entity ? db`and entity = ${sp.entity}` : db``} ${sp.id ? db`and entity_id = ${sp.id}` : db``}
    order by created_at desc limit 50 offset ${(page - 1) * 50}`;
  const total = Number(rows[0]?.total ?? 0);
  return (
    <>
      <PageHeader title="Audit log" description="Every admin change: score edits, rating adjustments, imports, publishing and settings, with the values before and after." />
      <div className="card divide-y divide-line">
        {rows.map((r) => (
          <details key={r.id} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm">
              <span><span className="font-semibold">{r.action}</span> <span className="text-muted">{r.entity}{r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}</span></span>
              <span className="text-xs text-muted">{r.actor_email ?? "system"} · {fmtDate(r.created_at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </summary>
            <div className="mt-3 grid gap-3 text-xs lg:grid-cols-2">
              <pre className="max-h-72 overflow-auto rounded-lg bg-space p-3 text-muted">{r.before ? JSON.stringify(r.before, null, 2) : "(no previous value)"}</pre>
              <pre className="max-h-72 overflow-auto rounded-lg bg-space p-3 text-silver">{r.after ? JSON.stringify(r.after, null, 2) : "(removed)"}</pre>
            </div>
          </details>
        ))}
        {!rows.length && <p className="p-6 text-sm text-muted">No activity yet.</p>}
      </div>
      <Pagination page={page} total={total} pageSize={50} hrefFor={(n) => `/admin/audit?${new URLSearchParams(Object.entries({ ...sp, page: String(n) }).filter(([, v]) => v) as [string, string][])}`} />
    </>
  );
}
