import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { eventReport } from "@/lib/ladder/report";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Event report" };
export const dynamic = "force-dynamic";

export default async function EventReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await eventReport(id).catch(() => null);
  if (!r) notFound();
  const e = r.bundle.event;
  const dl = (q: string) => `/api/admin/events/${id}/export?${q}`;
  return (
    <div className="print:text-black">
      <PageHeader title={`Report: ${e.title}`} description={`${fmtDate(e.event_date)} · ${e.club_name ?? e.venue_name ?? "[VENUE]"} · ${r.state.event.state}`}
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          <a href={dl("format=xlsx")} className="btn-primary btn-sm">Download XLSX</a>
          <a href={dl("format=csv&kind=totals")} className="btn-ghost btn-sm">Totals CSV</a>
          <a href={dl("format=csv&kind=matches")} className="btn-ghost btn-sm">Rounds CSV</a>
          <a href={dl("format=csv&kind=audit")} className="btn-ghost btn-sm">Audit CSV</a>
          <Link href={`/admin/events/${id}`} className="btn-ghost btn-sm">Back</Link>
        </div>} />
      <p className="mb-4 text-xs text-muted print:hidden">Use your browser&apos;s Print to get a paper copy.</p>
      {[["Totals", r.totals], ["Round by round", r.matches]].map(([title, rows]) => {
        const list = rows as Record<string, unknown>[];
        return (
          <section key={title as string} className="card mb-6 overflow-x-auto p-5">
            <h2 className="mb-3 font-bold">{title as string}</h2>
            {list.length ? (
              <table className="table-base text-xs">
                <thead><tr>{Object.keys(list[0]).map((k) => <th key={k}>{k}</th>)}</tr></thead>
                <tbody>{list.map((row, i) => <tr key={i}>{Object.values(row).map((v, j) => <td key={j} className="tabular-nums">{String(v ?? "")}</td>)}</tr>)}</tbody>
              </table>
            ) : <p className="text-sm text-muted">Nothing yet.</p>}
          </section>
        );
      })}
      <section className="card p-5">
        <h2 className="mb-3 font-bold">Audit trail ({r.audit.length})</h2>
        <table className="table-base text-xs"><thead><tr><th>Time</th><th>Action</th><th>By</th><th>Reason</th></tr></thead>
          <tbody>{r.audit.map((a, i) => <tr key={i}><td className="tabular-nums text-muted">{a.Time.replace("T", " ").slice(0, 19)}</td><td>{a.Action}</td><td>{a.Actor}</td><td>{a.Reason}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
