/**
 * Creates (or updates) an administrator.
 *   npm run admin:create -- you@example.com "a strong password" "Your Name"
 * With Supabase configured it creates the Supabase Auth user (service role key
 * needed) and links it; otherwise it stores a local password hash for dev login.
 */
import "./env";
import { sql } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) throw new Error('Usage: npm run admin:create -- email "password" "Name"');
  if (password.length < 10) throw new Error("Use a password of at least 10 characters.");
  const db = sql();
  let id: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error && !/already/i.test(error.message)) throw error;
    if (data?.user) id = data.user.id;
    else {
      const { data: list } = await sb.auth.admin.listUsers();
      id = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
    }
    console.log("Supabase Auth user ready:", email);
  }
  const hash = process.env.NEXT_PUBLIC_SUPABASE_URL ? null : hashPassword(password);
  const [row] = id
    ? await db`insert into users (id, email, display_name, role, password_hash) values (${id}, ${email}, ${name ?? null}, 'admin', ${hash})
               on conflict (email) do update set id = excluded.id, display_name = coalesce(excluded.display_name, users.display_name), password_hash = excluded.password_hash returning id, email`
    : await db`insert into users (email, display_name, role, password_hash) values (${email}, ${name ?? null}, 'admin', ${hash})
               on conflict (email) do update set display_name = coalesce(excluded.display_name, users.display_name), password_hash = excluded.password_hash returning id, email`;
  console.log("Administrator ready:", row.email);
  await db.end();
}
main().catch(async (e) => { console.error(e.message ?? e); await sql().end(); process.exit(1); });
