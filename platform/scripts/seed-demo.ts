import "./env";
import { sql } from "../src/lib/db";
import { seedDemoData } from "../src/lib/demo";
import { seedLadderDemo } from "../src/lib/ladder/demo";

// Run with the react-server condition (see package.json) so server-only modules load.
async function main() {
  const r = await seedDemoData();
  console.log("Demo data loaded:", r);
  const [u] = await sql()`select id, email, display_name, role from users where role = 'admin' order by created_at limit 1`;
  if (!u) { console.log("No admin user yet, skipped the demo Ladder nights. Create an admin, then load demo data from Website settings."); return; }
  const l = await seedLadderDemo({ id: u.id, email: u.email, displayName: u.display_name, role: u.role });
  console.log("Demo Ladder nights:", l);
}
main().then(() => sql().end()).catch(async (e) => { console.error(e.message ?? e); await sql().end(); process.exit(1); });
