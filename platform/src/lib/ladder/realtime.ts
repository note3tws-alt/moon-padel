import "server-only";

/**
 * Tells open screens that an event changed. With Supabase configured this
 * sends a Realtime broadcast (no database access for the browser; the topic
 * name is the secret screen token). Screens then fetch the new state from
 * /api/live. Without Supabase, screens fall back to polling.
 */
export async function notifyEvent(t: { tv: string; kiosk: string; id: string }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const topics = [`mp-${t.tv}`, `mp-${t.kiosk}`, `mp-pub-${t.id}`];
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: topics.map((topic) => ({ topic, event: "changed", payload: { at: Date.now() } })) }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    // Screens still poll, so a missed broadcast only delays an update by a few seconds.
    console.warn("[live] broadcast failed:", (err as Error).message);
  }
}
