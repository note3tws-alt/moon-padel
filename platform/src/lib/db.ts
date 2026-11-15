import postgres from "postgres";

/**
 * Server-side Postgres connection. On Supabase use the pooled connection
 * string (Transaction mode, port 6543). Prepared statements are disabled so
 * the transaction pooler works.
 */
declare global {
  var __moonSql: postgres.Sql | undefined;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new DatabaseNotConfiguredError();
  }
  // DATABASE_SESSION_POOLER=1 switches Supabase's transaction pooler (6543) to its session pooler (5432).
  const useSession = process.env.DATABASE_SESSION_POOLER === "1" && url.includes(":6543/");
  return createClient(useSession ? url.replace(":6543/", ":5432/") : url);
}

export function createClient(url: string) {
  const local = /localhost|127\.0\.0\.1/.test(url);
  const options = {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX ?? (local ? 10 : 5)),
    // Supabase's transaction pooler can stall when several queries are
    // pipelined on one connection, so send one query at a time per connection.
    max_pipeline: local ? 100 : 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local || process.env.DATABASE_SSL === "disable" ? false : "require",
    types: {
      // numeric -> JS number (all our numerics are small)
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      // date stays a YYYY-MM-DD string
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
    transform: { undefined: null },
    onnotice: () => {},
  };
  return postgres(url, options as postgres.Options<Record<string, postgres.PostgresType>>);
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. See platform/README.md to connect a database.");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function sql(): postgres.Sql {
  if (!globalThis.__moonSql) globalThis.__moonSql = create();
  return globalThis.__moonSql;
}

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;
