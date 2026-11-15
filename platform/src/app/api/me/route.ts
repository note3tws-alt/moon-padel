import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { getLinkedPlayer, getPlayerUser } from "@/lib/player-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/** Who is signed in, for the header button. Never cached: the answer is per person. */
export async function GET() {
  const user = await getPlayerUser().catch(() => null);
  if (!user) return NextResponse.json({ signedIn: false }, { headers: NO_STORE });
  const player = isDatabaseConfigured() ? await getLinkedPlayer(user.id).catch(() => null) : null;
  return NextResponse.json(
    { signedIn: true, name: player?.full_name ?? user.name ?? null, photo: player?.photo_url ?? user.avatarUrl ?? null, linked: Boolean(player) },
    { headers: NO_STORE },
  );
}
