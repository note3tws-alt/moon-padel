import { preload } from "react-dom";
import { cn } from "@/lib/utils";

export type Phase = "full" | "gibbous" | "half" | "crescent";

const MARK_WIDTHS = [96, 192, 256, 448, 640, 832];
const markSrcSet = (ext: "avif" | "webp") => MARK_WIDTHS.map((w) => `/brand/mark/moon-mark-${w}.${ext} ${w}w`).join(", ");
const markWidth = (size: number) => MARK_WIDTHS.find((w) => w >= size * 2) ?? 832;

/** The founders' moon mark. Phases are CSS masks over the real artwork. */
export function MoonMark({ size = 40, phase = "full", glow = false, className, priority, sizes }: { size?: number; phase?: Phase; glow?: boolean; className?: string; priority?: boolean; sizes?: string }) {
  // The hero mark is the largest thing on the home page: start fetching it from the <head>.
  if (priority) preload(`/brand/mark/moon-mark-${markWidth(size)}.avif`, { as: "image", type: "image/avif", imageSrcSet: markSrcSet("avif"), imageSizes: sizes ?? `${size}px`, fetchPriority: "high" });
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {glow && <span className="absolute inset-[10%] rounded-full bg-space shadow-glow" aria-hidden />}
      {/* Pre-sized AVIF (about a third of the WebP size) with a WebP fallback,
          served as static files from the CDN instead of the image function. */}
      <picture className="contents">
        <source type="image/avif" srcSet={markSrcSet("avif")} sizes={sizes ?? `${size}px`} />
        <img
          src={`/brand/mark/moon-mark-${markWidth(size)}.webp`}
          srcSet={markSrcSet("webp")}
          sizes={sizes ?? `${size}px`}
          alt=""
          width={size}
          height={size}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          className={cn("relative h-full w-full select-none", phase !== "full" && `phase-${phase}`)}
        />
      </picture>
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
