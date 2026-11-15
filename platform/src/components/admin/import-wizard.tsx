"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { FIELDS, IMPORT_KINDS, type ImportKind } from "@/lib/import/fields";
import { cn } from "@/lib/utils";
import { toast } from "./toast";

type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[]; mapping: Record<string, string>; truncated: boolean; sheetName?: string };
type RowResult = { row: number; status: "insert" | "update" | "skip" | "error"; message: string; changes?: string[]; warnings?: string[] };
type Result = { results: RowResult[]; counts: Record<RowResult["status"], number>; committed: boolean; importId?: string; recalc?: { matchesProcessed: number } };

const STATUS_STYLE: Record<RowResult["status"], string> = {
  insert: "bg-electric/15 text-ice",
  update: "bg-court/40 text-ice",
  skip: "bg-white/5 text-muted",
  error: "bg-loss/15 text-[#f2a08c]",
};
const STATUS_LABEL: Record<RowResult["status"], string> = { insert: "New", update: "Update", skip: "Skipped", error: "Error" };

export function ImportWizard({ initialKind }: { initialKind: ImportKind }) {
  const router = useRouter();
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"add_new" | "update">("add_new");
  const [matchByName, setMatchByName] = useState(false);
  const [strict, setStrict] = useState(false);
  const [publishResults, setPublishResults] = useState(true);
  const [createMissingPlayers, setCreateMissingPlayers] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Result | null>(null);
  const [final, setFinal] = useState<Result | null>(null);
  const [filter, setFilter] = useState<RowResult["status"] | "all">("all");
  const fields = FIELDS[kind];

  function reset(k = kind) {
    setKind(k); setStep(1); setParsed(null); setMapping({}); setPreview(null); setFinal(null); setFilter("all");
  }

  async function upload(file: File) {
    setBusy("Reading file…");
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", kind);
      const res = await fetch("/api/admin/import/parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setParsed(json);
      setMapping(json.mapping);
      setStep(2);
      if (json.truncated) toast("Only the first 5,000 rows were read. Split larger files.", "error");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally { setBusy(null); }
  }

  async function run(commit: boolean) {
    if (!parsed) return;
    setBusy(commit ? "Importing and recalculating rankings…" : "Validating every row…");
    try {
      const res = await fetch("/api/admin/import/run", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, commit, fileName: parsed.fileName, mapping, rows: parsed.rows, options: { mode, matchByName, strict, publishResults, createMissingPlayers } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      if (commit) {
        setFinal(json);
        setStep(4);
        if (json.committed) { toast(`Import complete: ${json.counts.insert} new, ${json.counts.update} updated`, "success"); router.refresh(); }
        else toast("Nothing was imported because some rows have errors (strict mode).", "error");
      } else {
        setPreview(json);
        setStep(3);
        setFilter(json.counts.error ? "error" : "all");
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally { setBusy(null); }
  }

  function downloadFailed(r: Result) {
    if (!parsed) return;
    const failed = r.results.filter((x) => x.status === "error" && x.row >= 2).map((x) => ({ row: x.row, error: x.message, ...parsed.rows[x.row - 2] }));
    const csv = Papa.unparse(failed);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `failed-rows-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const missingRequired = fields.filter((f) => f.required && !mapping[f.key]);
  const shown = useMemo(() => (preview?.results ?? []).filter((r) => filter === "all" || r.status === filter), [preview, filter]);

  return (
    <div className="space-y-6">
      {/* Steps */}
      <ol className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
        {["Upload", "Map columns", "Preview & validate", "Done"].map((s, i) => (
          <li key={s} className={cn("rounded-full border px-3 py-1.5", step === i + 1 ? "border-electric bg-electric/15 text-white" : step > i + 1 ? "border-line text-ice" : "border-line text-muted")}>{i + 1}. {s}</li>
        ))}
      </ol>

      {busy && <div className="card flex items-center gap-3 p-4 text-sm" role="status"><span className="h-4 w-4 animate-spin rounded-full border-2 border-electric border-t-transparent" />{busy}</div>}

      {step === 1 && (
        <section className="card p-5">
          <h2 className="mb-3 font-bold">What are you uploading?</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {IMPORT_KINDS.map((k) => (
              <button key={k.kind} type="button" onClick={() => reset(k.kind)} className={cn("rounded-xl border p-4 text-left transition", kind === k.kind ? "border-electric bg-electric/10" : "border-line hover:border-ice/30")}>
                <p className="font-bold">{k.label}</p><p className="mt-1 text-xs text-muted">{k.description}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted">Templates:</span>
            <a className="btn-ghost btn-sm" href={`/api/admin/templates/${kind}?format=xlsx`}>Excel template</a>
            <a className="btn-ghost btn-sm" href={`/api/admin/templates/${kind}?format=csv`}>CSV template</a>
          </div>
          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-space/40 px-6 py-12 text-center transition hover:border-electric/50"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}>
            <span className="text-lg font-bold">Drop an Excel or CSV file here</span>
            <span className="mt-1 text-sm text-muted">or click to choose (.xlsx or .csv, up to 8 MB / 5,000 rows)</span>
            <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={!!busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
        </section>
      )}

      {step === 2 && parsed && (
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Map your columns</h2>
              <p className="text-xs text-muted">{parsed.fileName}{parsed.sheetName ? ` · sheet "${parsed.sheetName}"` : ""} · {parsed.rows.length} rows · {parsed.headers.length} columns. We matched what we could; check each field.</p>
            </div>
            <button type="button" className="btn-ghost btn-sm" onClick={() => reset()}>Choose another file</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="field-label">{f.label}{f.required && <span className="text-ice"> *</span>}</span>
                <select className={cn("select", f.required && !mapping[f.key] && "border-loss/60")} value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}>
                  <option value="">Not in this file</option>
                  {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                {f.hint && <span className="mt-1 block text-[11px] text-muted">{f.hint}</span>}
              </label>
            ))}
          </div>
          <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted">First rows as they will be read</h3>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="table-base text-xs">
              <thead><tr><th>Row</th>{fields.filter((f) => mapping[f.key]).map((f) => <th key={f.key}>{f.label}</th>)}</tr></thead>
              <tbody>{parsed.rows.slice(0, 5).map((r, i) => (
                <tr key={i}><td className="text-muted">{i + 2}</td>{fields.filter((f) => mapping[f.key]).map((f) => <td key={f.key}>{r[mapping[f.key]] || <span className="text-muted/50">empty</span>}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>

          <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted">Import options</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-line p-4 text-sm">
              <label className="flex items-start gap-2"><input type="radio" name="mode" checked={mode === "add_new"} onChange={() => setMode("add_new")} className="mt-1 accent-electric" /><span><b>Add new records only.</b> <span className="text-muted">Existing records are left untouched and reported as skipped.</span></span></label>
              <label className="flex items-start gap-2"><input type="radio" name="mode" checked={mode === "update"} onChange={() => setMode("update")} className="mt-1 accent-electric" /><span><b>Update existing records</b> and add new ones. <span className="text-muted">Only cells with a value overwrite; every change is listed before you confirm.</span></span></label>
            </div>
            <div className="space-y-2 rounded-xl border border-line p-4 text-sm">
              {kind === "players" && <label className="flex items-start gap-2"><input type="checkbox" checked={matchByName} onChange={(e) => setMatchByName(e.target.checked)} className="mt-1 accent-electric" /><span>Match by exact name when a row has no player ID or email <span className="text-muted">(otherwise same-name rows are flagged as possible duplicates)</span></span></label>}
              {kind === "matches" && <label className="flex items-start gap-2"><input type="checkbox" checked={publishResults} onChange={(e) => setPublishResults(e.target.checked)} className="mt-1 accent-electric" /><span>Publish results for these tournaments <span className="text-muted">(updates rankings and profiles straight away)</span></span></label>}
              {(kind === "matches" || kind === "history") && <label className="flex items-start gap-2"><input type="checkbox" checked={createMissingPlayers} onChange={(e) => setCreateMissingPlayers(e.target.checked)} className="mt-1 accent-electric" /><span>Create players that are not found by name</span></label>}
              <label className="flex items-start gap-2"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} className="mt-1 accent-electric" /><span>Only import if every row is valid <span className="text-muted">(otherwise valid rows are imported and failed rows can be downloaded)</span></span></label>
            </div>
          </div>
          {missingRequired.length > 0 && <p className="mt-4 text-sm text-[#f2a08c]">Map the required fields: {missingRequired.map((f) => f.label).join(", ")}.</p>}
          <div className="mt-5 flex justify-end"><button type="button" className="btn-primary" disabled={!!busy || missingRequired.length > 0} onClick={() => run(false)}>Validate {parsed.rows.length} rows</button></div>
        </section>
      )}

      {step === 3 && preview && parsed && (
        <section className="card p-5">
          <h2 className="font-bold">Preview: nothing has been saved yet</h2>
          <p className="mt-1 text-sm text-muted">Every row was checked against the database exactly as the import will run.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["insert", "update", "skip", "error"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setFilter(filter === s ? "all" : s)} className={cn("rounded-xl border p-4 text-left", filter === s ? "border-electric" : "border-line")}>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{s === "insert" ? "New" : s === "update" ? "Updates" : s === "skip" ? "Skipped / duplicates" : "Errors"}</p>
                <p className={cn("mt-1 text-2xl font-extrabold", s === "error" && preview.counts.error ? "text-[#f2a08c]" : "")}>{preview.counts[s]}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-[28rem] overflow-auto rounded-xl border border-line">
            <table className="table-base text-xs">
              <thead className="sticky top-0 bg-night"><tr><th>Row</th><th>Result</th><th>Details</th></tr></thead>
              <tbody>{shown.slice(0, 1000).map((r, i) => (
                <tr key={i} className="align-top">
                  <td className="text-muted">{r.row || "–"}</td>
                  <td><span className={cn("rounded-md px-2 py-0.5 font-bold", STATUS_STYLE[r.status])}>{STATUS_LABEL[r.status]}</span></td>
                  <td className="whitespace-normal">
                    {r.message}
                    {r.changes?.length ? <ul className="mt-1 list-disc pl-4 text-muted">{r.changes.map((c, j) => <li key={j}>{c}</li>)}</ul> : null}
                    {r.warnings?.length ? <ul className="mt-1 text-ice/80">{r.warnings.map((w, j) => <li key={j}>⚠ {w}</li>)}</ul> : null}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {!shown.length && <p className="p-4 text-sm text-muted">No rows in this group.</p>}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" className="btn-ghost btn-sm" onClick={() => setStep(2)}>Back to mapping</button>
              {preview.counts.error > 0 && <button type="button" className="btn-ghost btn-sm" onClick={() => downloadFailed(preview)}>Download failed rows</button>}
            </div>
            <button type="button" className="btn-primary" disabled={!!busy || (preview.counts.insert + preview.counts.update === 0) || (strict && preview.counts.error > 0)} onClick={() => run(true)}>
              Confirm import ({preview.counts.insert} new, {preview.counts.update} updates)
            </button>
          </div>
          {strict && preview.counts.error > 0 && <p className="mt-2 text-right text-xs text-[#f2a08c]">Strict mode is on: fix the errors or untick it to import the valid rows.</p>}
        </section>
      )}

      {step === 4 && final && (
        <section className="card p-5">
          <h2 className="text-lg font-bold">{final.committed ? "Import complete" : "Nothing was imported"}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Added" value={final.counts.insert} /><Stat label="Updated" value={final.counts.update} /><Stat label="Skipped" value={final.counts.skip} /><Stat label="Failed" value={final.counts.error} />
          </div>
          {final.committed && <p className="mt-4 text-sm text-muted">Saved in one transaction. {final.recalc ? `Ratings, points and rankings were recalculated from ${final.recalc.matchesProcessed} matches. ` : ""}The public leaderboard, player profiles and homepage already show the new data.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {final.counts.error > 0 && <button type="button" className="btn-ghost btn-sm" onClick={() => downloadFailed(final)}>Download failed rows</button>}
            <Link href="/leaderboard" target="_blank" className="btn-ghost btn-sm">View leaderboard ↗</Link>
            <button type="button" className="btn-primary btn-sm" onClick={() => reset()}>Upload another file</button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-line p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div>;
}
