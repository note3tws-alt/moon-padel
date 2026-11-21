import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fade-and-rise as a block scrolls into view, in CSS only (no JavaScript, no animation library).
 * Uses scroll-driven animations where the browser supports them; elsewhere the content simply shows.
 * Content is never hidden before the page is interactive, so it never delays the first paint.
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const style = delay ? ({ "--reveal-delay": `${Math.round(delay * 100)}%` } as CSSProperties) : undefined;
  return <div className={cn("reveal", className)} style={style}>{children}</div>;
}
