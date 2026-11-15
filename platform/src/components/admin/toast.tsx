"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type T = { id: number; text: string; kind: "success" | "error" | "info" };
let push: ((t: Omit<T, "id">) => void) | null = null;
export function toast(text: string, kind: T["kind"] = "info") { push?.({ text, kind }); }

export function Toaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.kind === "error" ? 7000 : 3500);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur ${t.kind === "error" ? "border-loss/40 bg-[#2a1210]/95 text-[#f7b4a3]" : t.kind === "success" ? "border-electric/40 bg-night/95 text-ice" : "border-line bg-night/95"}`}
            role={t.kind === "error" ? "alert" : "status"}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
