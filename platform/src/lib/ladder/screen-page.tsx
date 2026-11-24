import "server-only";
import { isDatabaseConfigured } from "../db";
import { findEventByToken, getLiveState, type LiveState } from "./live";

export async function loadScreen(token: string, want: "kiosk" | "tv"): Promise<LiveState | null> {
  if (!isDatabaseConfigured()) return null;
  const ev = await findEventByToken(token);
  if (!ev) return null;
  // The kiosk link also opens the TV view (handy for testing); the TV link never opens the kiosk.
  if (want === "kiosk" && ev.access !== "kiosk") return null;
  return getLiveState(ev.id, ev.access);
}
