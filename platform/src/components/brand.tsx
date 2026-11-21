import Image from "next/image";
import { cn } from "@/lib/utils";

export type Phase = "full" | "gibbous" | "half" | "crescent";

/** The founders' moon mark. Phases are CSS masks over the real artwork. */
export function MoonMark({ size = 40, phase = "full", glow = false, className, priority, sizes }: { size?: number; phase?: Phase; glow?: boolean; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {glow && <span className="absolute inset-[10%] rounded-full bg-space shadow-glow" aria-hidden />}
      <Image
        src="/brand/moon-mark.webp"
        alt=""
        width={size}
        height={size}
        priority={priority}
        fetchPriority={priority ? "high" : undefined}
        className={cn("relative h-full w-full select-none", phase !== "full" && `phase-${phase}`)}
        sizes={sizes ?? `${size}px`}
      />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tightish", className)}>
      <span className="text-silver">Moon</span>
      <span className="text-gradient-padel">Padel</span>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MoonMark size={34} />
      <Wordmark className="text-xl" />
    </span>
  );
}

const PHASE_BY_ORDER: Record<number, Phase> = { 1: "full", 2: "gibbous", 3: "half", 4: "crescent" };

export function divisionPhase(sortOrder?: number | null): Phase {
  return PHASE_BY_ORDER[sortOrder ?? 4] ?? "crescent";
}

export function DivisionBadge({ code, name, sortOrder, size = "sm" }: { code?: string | null; name?: string | null; sortOrder?: number | null; size?: "sm" | "md" }) {
  if (!code) return <span className="text-muted">–</span>;
  const order = sortOrder ?? Number(code.replace(/\D/g, "")) ?? 4;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] font-bold uppercase tracking-wider text-ice", size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs")}>
      <MoonMark size={size === "sm" ? 12 : 16} phase={divisionPhase(order)} />
      {code}
      {name && <span className="font-semibold normal-case tracking-normal text-muted">{name}</span>}
    </span>
  );
}
