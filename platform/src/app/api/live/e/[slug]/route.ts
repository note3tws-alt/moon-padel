import { NextResponse } from "next/server";
import { findPublicEvent } from "@/lib/ladder/live";
import { errorResponse, liveResponse, NO_STORE } from "@/lib/ladder/http";

export const dynamic = "force-dynamic";

/** Public live view of an event (phones, website). Same data as the TV. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const id = await findPublicEvent(slug);
    if (!id) return NextResponse.json({ error: "Event not found." }, { status: 404, headers: NO_STORE });
    return await liveResponse(id, "public", req.url);
  } catch (e) {
    return errorResponse(e);
  }
}
