import { cn } from "@/lib/utils";
import { STATE_LABELS, type EventState } from "@/lib/ladder/service";

const style: Record<string, string> = {
  draft: "border-dashed border-line text-muted",
  checkin_open: "border-electric/40 text-ice bg-electric/10",
  ready: "border-ice/40 text-ice",
  round_live: "border-electric/60 text-white bg-electric/20",
  score_collection: "border-gold/50 text-gold bg-gold/10",
  round_locked: "border-ice/30 text-silver",
  completed: "border-line text-muted",
  cancelled: "border-loss/40 text-[#f2a08c]",
};

export function EventStateChip({ state, round, rounds }: { state: string; round?: number; rounds?: number }) {
  const live = state === "round_live" || state === "score_collection";
  return (
    <span className={cn("chip", style[state] ?? "border-line")}>
      {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {STATE_LABELS[state as EventState] ?? state}
      {round && rounds && ["round_live", "score_collection", "round_locked"].includes(state) ? ` · R${round}/${rounds}` : ""}
    </span>
  );
}
