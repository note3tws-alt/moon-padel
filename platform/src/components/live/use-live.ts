"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveState } from "@/lib/ladder/live";

export type Connection = "live" | "polling" | "offline";

/**
 * Keeps a screen in sync with the event: a Supabase Realtime ping when
 * available (instant), plus a safety poll that only downloads when the
 * version changed. If the club Wi-Fi drops, it shows offline and catches up
 * as soon as the connection is back. Nothing is lost: the server holds the state.
 */
export function useLive(initial: LiveState, endpoint: string, topic: string | null) {
  const [state, setState] = useState<LiveState>(initial);
  const [conn, setConn] = useState<Connection>("polling");
  const [offset, setOffset] = useState(() => initial.serverTime - Date.now());
  const versionRef = useRef(initial.version);
  const realtimeRef = useRef(false);
  const inflight = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const res = await fetch(`${endpoint}?v=${force ? 0 : versionRef.current}`, { cache: "no-store" });
      if (res.status === 204) { setConn(realtimeRef.current ? "live" : "polling"); return; }
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as LiveState;
      versionRef.current = next.version;
      setOffset(next.serverTime - Date.now());
      setState(next);
      setConn(realtimeRef.current ? "live" : "polling");
    } catch {
      setConn("offline");
    } finally {
      inflight.current = false;
    }
  }, [endpoint]);

  // Safety poll: fast without realtime, slow with it.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") await refresh();
      timer = setTimeout(tick, realtimeRef.current ? 15000 : 2500);
    };
    timer = setTimeout(tick, 2500);
    const onOnline = () => refresh(true);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => { stop = true; clearTimeout(timer); window.removeEventListener("online", onOnline); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  // Realtime ping.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !topic) return;
    let cleanup = () => {};
    let cancelled = false;
    import("@supabase/supabase-js").then(({ createClient }) => {
      if (cancelled) return;
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = client.channel(topic).on("broadcast", { event: "changed" }, () => refresh()).subscribe((status) => {
        realtimeRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") { setConn("live"); refresh(); }
      });
      cleanup = () => { client.removeChannel(ch); realtimeRef.current = false; };
    }).catch(() => {});
    return () => { cancelled = true; cleanup(); };
  }, [topic, refresh]);

  const now = useCallback(() => Date.now() + offset, [offset]);
  return { state, conn, refresh, now };
}

/** Seconds left on the round clock, ticking every second. */
export function useCountdown(state: LiveState, now: () => number) {
  const calc = useCallback(() => {
    if (state.event.state !== "round_live") return null;
    if (state.event.pausedRemaining !== null) return state.event.pausedRemaining;
    if (!state.event.roundEndsAt) return null;
    return Math.max(0, Math.round((state.event.roundEndsAt - now()) / 1000));
  }, [state, now]);
  const [left, setLeft] = useState<number | null>(calc);
  useEffect(() => {
    setLeft(calc());
    const t = setInterval(() => setLeft(calc()), 500);
    return () => clearInterval(t);
  }, [calc]);
  return left;
}

export const fmtClock = (s: number | null) => (s === null ? "--:--" : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
