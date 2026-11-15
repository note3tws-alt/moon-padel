"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

/** A select that updates one query parameter and resets pagination. */
export function UrlSelect({ name, value, options, label, className }: { name: string; value: string; options: { value: string; label: string }[]; label: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <select
        className="select min-w-[10rem]"
        value={value}
        aria-label={label}
        disabled={pending}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set(name, e.target.value); else next.delete(name);
          next.delete("page");
          start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
