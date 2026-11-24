import "server-only";
import { NextResponse } from "next/server";
import { LadderError } from "./engine";
import { getLiveState, eventVersion, type LiveAccess } from "./live";

export const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/** Live state, or 204 when the screen already has the latest version (cheap polling). */
export async function liveResponse(id: string, access: LiveAccess, url: string) {
  const have = Number(new URL(url).searchParams.get("v") ?? "0");
  if (have) {
    const v = await eventVersion(id);
    if (v === have) return new NextResponse(null, { status: 204, headers: NO_STORE });
  }
  const state = await getLiveState(id, access);
  return NextResponse.json(state, { headers: NO_STORE });
}

export function errorResponse(e: unknown) {
  if (e instanceof LadderError) {
    const status = e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : e.code === "conflict" ? 409 : 400;
    return NextResponse.json({ error: e.message, code: e.code }, { status, headers: NO_STORE });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500, headers: NO_STORE });
}
