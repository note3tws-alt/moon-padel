import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { errorResponse, liveResponse, NO_STORE } from "@/lib/ladder/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401, headers: NO_STORE });
  try {
    const { id } = await params;
    return await liveResponse(id, "admin", req.url);
  } catch (e) {
    return errorResponse(e);
  }
}
