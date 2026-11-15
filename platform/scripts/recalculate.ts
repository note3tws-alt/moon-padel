import "./env";
import { sql } from "../src/lib/db";
import { recalculateAll } from "../src/lib/recalc";
recalculateAll("cli").then(async (r) => { console.log("Recalculated:", r); await sql().end(); }).catch(async (e) => { console.error(e); await sql().end(); process.exit(1); });
