import { NextResponse } from "next/server";
import { z } from "zod";
import { findEventByToken } from "@/lib/ladder/live";
import { checkIn, respondToScore, submitScore } from "@/lib/ladder/service";
import { errorResponse, NO_STORE } from "@/lib/ladder/http";

export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checkin"), playerId: z.string().uuid(), pin: z.string().max(4).optional() }),
  z.object({
    action: z.literal("submit"), matchId: z.string().uuid(), playerId: z.string().uuid(),
    team1Games: z.number().int().min(0).max(99), team2Games: z.number().int().min(0).max(99),
    goldenPoint: z.union([z.literal(1), z.literal(2)]).nullable().optional(), revision: z.number().int(), pin: z.string().max(4).optional(),
  }),
  z.object({ action: z.enum(["confirm", "dispute"]), matchId: z.string().uuid(), playerId: z.string().uuid(), revision: z.number().int(), pin: z.string().max(4).optional() }),
]);

/** Player actions from the venue tablet. Only the kiosk link can write; the TV link is read-only. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const ev = await findEventByToken(token);
    if (!ev || ev.access !== "kiosk") return NextResponse.json({ error: "This tablet link is not valid." }, { status: 403, headers: NO_STORE });
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request was not understood." }, { status: 400, headers: NO_STORE });
    const b = parsed.data;
    const actor = { kind: "kiosk" as const };
    let result: unknown;
    if (b.action === "checkin") result = await checkIn(ev.id, b.playerId, actor, { pin: b.pin });
    else if (b.action === "submit") result = await submitScore(ev.id, b, actor);
    else result = await respondToScore(ev.id, { ...b, agree: b.action === "confirm" }, actor);
    return NextResponse.json({ ok: true, result }, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
