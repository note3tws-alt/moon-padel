import type { Config } from "tailwindcss";

// Tokens from brand/README.md (MoonPadel logo kit).
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        space: "#04070F",
        night: { DEFAULT: "#0A1428", 2: "#0E1B35", 3: "#132344" },
        court: "#1D3FA6",
        electric: "#2E8BEA",
        ice: "#A9DBFF",
        silver: "#E9EEF5",
        muted: "#8FA0BC",
        gold: "#C9A24A",
        loss: "#D9644A",
        line: "rgba(169, 219, 255, 0.10)",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
      letterSpacing: { brand: "0.42em", label: "0.24em", tightish: "-0.02em" },
      boxShadow: {
        glow: "0 0 90px 16px rgba(46,139,234,0.35)",
        card: "0 1px 0 rgba(169,219,255,0.06) inset, 0 20px 40px -24px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "night-fade": "radial-gradient(1200px 600px at 70% -10%, rgba(46,139,234,0.18), transparent 60%), radial-gradient(800px 400px at 0% 0%, rgba(29,63,166,0.25), transparent 60%)",
        "padel-gradient": "linear-gradient(180deg, #C4E8FF 0%, #2E8BEA 95%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
