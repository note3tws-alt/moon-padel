import "./env";
import { sql } from "../src/lib/db";
import { seedDemoData } from "../src/lib/demo";
seedDemoData().then(async (r) => { console.log("Demo data loaded:", r); await sql().end(); }).catch(async (e) => { console.error(e.message ?? e); await sql().end(); process.exit(1); });
