import "./env";
import { sql } from "../src/lib/db";
import { removeDemoData } from "../src/lib/demo";
removeDemoData().then(async (r) => { console.log("Demo data removed:", r); await sql().end(); }).catch(async (e) => { console.error(e.message ?? e); await sql().end(); process.exit(1); });
