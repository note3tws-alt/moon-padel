import "server-only";
import { refreshPublicSite } from "@/lib/cache";
import { ZodError } from "zod";
import { assertAdmin, type AdminUser } from "../auth";
import { sql, type Tx } from "../db";
import { recalculateAll } from "../recalc";

export type ActionState = { ok: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; data?: unknown } | null;

/**
 * Wraps an admin mutation: checks the session, runs everything in one
 * transaction, optionally rebuilds rankings inside the same transaction, and
 * refreshes every public page. Errors become a friendly message.
 */
export async function adminMutation(
  fn: (ctx: { admin: AdminUser; tx: Tx }) => Promise<string | { message: string; data?: unknown } | void>,
  opts: { recalc?: boolean | ((result: unknown) => boolean); trigger?: string } = {},
): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const result = await sql().begin(async (tx) => {
      const r = await fn({ admin, tx });
      const shouldRecalc = typeof opts.recalc === "function" ? opts.recalc(r) : opts.recalc;
      if (shouldRecalc) await recalculateAll(opts.trigger ?? "admin", tx);
      return r;
    });
    await refreshPublicSite();
    if (typeof result === "string") return { ok: true, message: result };
    if (result && typeof result === "object") return { ok: true, message: result.message, data: result.data };
    return { ok: true, message: "Saved" };
  } catch (e) {
    return toError(e);
  }
}

export function toError(e: unknown): ActionState {
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of e.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const err = e as { code?: string; message?: string; detail?: string; constraint_name?: string };
  if (err?.code === "23505") return { ok: false, error: `That value is already in use${err.constraint_name ? ` (${humanConstraint(err.constraint_name)})` : ""}.` };
  if (err?.code === "23503") return { ok: false, error: "This record is still used elsewhere (for example in matches), so it cannot be removed." };
  if (err?.code === "23514") return { ok: false, error: "One of the values is out of the allowed range." };
  console.error(e);
  return { ok: false, error: err?.message ?? "Something went wrong." };
}

function humanConstraint(c: string) {
  if (c.includes("player_code")) return "player ID";
  if (c.includes("slug")) return "URL name";
  if (c.includes("email")) return "email";
  if (c.includes("round_number")) return "a match already exists on that round and court";
  return c;
}

export function formObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
}
