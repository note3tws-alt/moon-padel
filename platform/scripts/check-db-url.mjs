// Build-time check of DATABASE_URL. Prints only its shape (host, port, user,
// and whether the password looks malformed), never the password itself, then
// tries one connection. It never fails the build.
import postgres from "postgres";

const raw = process.env.DATABASE_URL;

async function main() {
  if (!raw) {
    console.log("[db-check] DATABASE_URL is not set for this build.");
    return;
  }
  const trimmed = raw.trim();
  const notes = [];
  if (trimmed !== raw) notes.push("has spaces or line breaks at the start or end");
  if (/^["']|["']$/.test(trimmed)) notes.push("is wrapped in quotes");
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    console.log("[db-check] DATABASE_URL is not a valid URL.", notes.join("; "));
    return;
  }
  const password = url.password;
  if (!password) notes.push("has no password");
  if (/YOUR-PASSWORD/i.test(password)) notes.push("still contains the YOUR-PASSWORD placeholder");
  if (/%5B|%5D|\[|\]/i.test(password)) notes.push("password contains square brackets");
  if (/\s|%20/.test(password)) notes.push("password contains a space");
  console.log(
    "[db-check] host=%s port=%s user=%s db=%s",
    url.hostname,
    url.port || "(default)",
    decodeURIComponent(url.username),
    url.pathname.slice(1) || "(none)",
  );
  console.log("[db-check] notes:", notes.length ? notes.join("; ") : "none");

  const sql = postgres(trimmed, { prepare: false, max: 1, ssl: "require", connect_timeout: 10 });
  try {
    const [row] = await sql`select current_user as u, (select count(*) from public.divisions)::int as divisions`;
    console.log("[db-check] connected OK as %s, divisions=%s", row.u, row.divisions);
  } catch (err) {
    console.log("[db-check] connection failed:", err.code ?? "", err.message);
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

main().catch((err) => console.log("[db-check] unexpected error:", err.message));
