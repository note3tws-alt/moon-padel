/**
 * Applies supabase/migrations/*.sql in order and records them in
 * public.schema_migrations. Use --local-shim on plain Postgres (not Supabase)
 * to create the auth stub first. On Supabase you can instead run
 * `supabase db push` or paste the files into the SQL editor.
 */
import "./env";
import fs from "node:fs";
import path from "node:path";
import { sql } from "../src/lib/db";

async function main() {
  const db = sql();
  if (process.argv.includes("--local-shim")) {
    await db.unsafe(fs.readFileSync(path.join(__dirname, "local-auth-shim.sql"), "utf8"));
    console.log("Applied local auth shim");
  }
  await db`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const dir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await db`select name from public.schema_migrations`).map((r) => r.name as string));
  for (const f of files) {
    if (done.has(f)) continue;
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    await db.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public.schema_migrations (name) values (${f})`;
    });
    console.log("Applied", f);
  }
  console.log("Migrations up to date");
  await db.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
