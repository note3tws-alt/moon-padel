"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "../toast";
import { fmtClock } from "@/components/live/use-live";

/** Re-renders the control centre when the tablet or another admin changes the event. */
export function AutoRefresh({ eventId, version }: { eventId: string; version: number }) {
  const router = useRouter();
  const v = useRef(version);
  const [offline, setOffline] = useState(false);
  useEffect(() => { v.current = version; }, [version]);
  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/live/${eventId}?v=${v.current}`, { cache: "no-store" });
        setOffline(!res.ok && res.status !== 204);
        if (res.status === 200) {
          const s = await res.json();
          if (s.version !== v.current) { v.current = s.version; router.refresh(); }
        }
      } catch { setOffline(true); }
      if (!stop) t = setTimeout(tick, 3000);
    };
    t = setTimeout(tick, 3000);
    return () => { stop = true; clearTimeout(t); };
  }, [eventId, router]);
  return (
    <span className={offline ? "chip border-loss/40 text-[#f2a08c]" : "chip text-ice"}>
      <span className={offline ? "h-1.5 w-1.5 rounded-full bg-loss" : "h-1.5 w-1.5 animate-pulse rounded-full bg-electric"} />
      {offline ? "Reconnecting" : "Live sync"}
    </span>
  );
}

export function Countdown({ endsAt, paused }: { endsAt: number | null; paused: number | null }) {
  const calc = () => (paused !== null ? paused : endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : null);
  const [left, setLeft] = useState<number | null>(calc);
  useEffect(() => {
    const t = setInterval(() => setLeft(calc()), 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, paused]);
  return <span className={`tabular-nums ${left !== null && left <= 60 ? "text-[#f2a08c]" : "text-white"}`}>{fmtClock(left)}{paused !== null ? " (paused)" : ""}</span>;
}

export function CopyLink({ url, label }: { url: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-space/60 p-2 pl-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="truncate font-mono text-xs text-silver">{url}</p>
      </div>
      <button type="button" className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(url); toast("Link copied", "success"); }}>Copy</button>
      <a href={url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">Open</a>
    </div>
  );
}
