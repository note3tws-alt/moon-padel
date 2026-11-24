import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { publicEventsFeed } from "@/lib/ladder/public";

export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

/**
 * Upcoming nights, recent podiums and lifetime points for the marketing site
 * (site/), which loads this from the browser. Cached on the CDN for a minute
 * and purged whenever an admin changes something.
 */
export async function GET() {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "not configured" }, { status: 503, headers: CORS });
  try {
    const feed = await publicEventsFeed();
    return NextResponse.json(feed, { headers: { ...CORS, "Cache-Control": "public, max-age=30" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: CORS });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
