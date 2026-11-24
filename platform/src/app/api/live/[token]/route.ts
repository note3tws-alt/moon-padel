import { NextResponse } from "next/server";
import { findEventByToken } from "@/lib/ladder/live";
import { errorResponse, liveResponse, NO_STORE } from "@/lib/ladder/http";

export const dynamic = "force-dynamic";

/** Live state for the venue tablet or TV, identified by the screen's secret link. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const ev = await findEventByToken(token);
    if (!ev) return NextResponse.json({ error: "This screen link is not valid any more." }, { status: 404, headers: NO_STORE });
    return await liveResponse(ev.id, ev.access, req.url);
  } catch (e) {
    return errorResponse(e);
  }
}
