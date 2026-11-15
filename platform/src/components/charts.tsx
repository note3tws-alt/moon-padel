"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

// Chart colours from the brand: Electric for the primary series, a validated
// warm contrast (#D9644A) for losses. Text stays in Silver/Muted, never series colours.
const ELECTRIC = "#2E8BEA";
const LOSS = "#D9644A";
const GRID = "rgba(169,219,255,0.08)";
const AXIS = { fill: "#8FA0BC", fontSize: 11 };

function Frame({ children, height = 220 }: { children: React.ReactElement; height?: number }) {
  return <div style={{ width: "100%", height }}><ResponsiveContainer>{children}</ResponsiveContainer></div>;
}

function TooltipBox({ active, payload, label, fmt }: { active?: boolean; payload?: { value: number; name: string; payload: Record<string, unknown> }[]; label?: string; fmt?: (v: number, p: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-space/95 px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-semibold text-muted">{label}</p>}
      {payload.map((p, i) => <p key={i} className="font-bold text-silver">{fmt ? fmt(p.value, p.payload) : p.value}</p>)}
    </div>
  );
}

export function RatingChart({ data }: { data: { label: string; rating: number }[] }) {
  if (data.length < 2) return <ChartEmpty text="Rating progression appears after a few rated matches." />;
  const vals = data.map((d) => d.rating);
  const min = Math.floor((Math.min(...vals) - 0.1) * 10) / 10;
  const max = Math.ceil((Math.max(...vals) + 0.1) * 10) / 10;
  return (
    <Frame>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="rtg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ELECTRIC} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ELECTRIC} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis domain={[min, max]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
        <Tooltip content={<TooltipBox fmt={(v) => `Rating ${v.toFixed(2)}`} />} cursor={{ stroke: "rgba(169,219,255,0.3)" }} />
        <Area type="monotone" dataKey="rating" stroke={ELECTRIC} strokeWidth={2} fill="url(#rtg)" dot={false} activeDot={{ r: 5, stroke: "#04070F", strokeWidth: 2 }} />
      </AreaChart>
    </Frame>
  );
}

export function MonthlyBarChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  if (!data.length) return <ChartEmpty text="No monthly results yet." />;
  return (
    <Frame>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<TooltipBox fmt={(v) => `${v} ${unit}`} />} cursor={{ fill: "rgba(169,219,255,0.05)" }} />
        <Bar dataKey="value" fill={ELECTRIC} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </Frame>
  );
}

export function WinLossDonut({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  if (!total) return <ChartEmpty text="No matches yet." />;
  const data = [{ name: "Wins", value: wins }, { name: "Losses", value: losses }];
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="#0A1428" strokeWidth={2} startAngle={90} endAngle={-270}>
              <Cell fill={ELECTRIC} />
              <Cell fill={LOSS} />
            </Pie>
            <Tooltip content={<TooltipBox fmt={(v, p) => `${p.name}: ${v}`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold">{Math.round((wins / total) * 100)}%</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Win rate</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ELECTRIC }} /> Wins <span className="font-bold tabular-nums">{wins}</span></li>
        <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: LOSS }} /> Losses <span className="font-bold tabular-nums">{losses}</span></li>
      </ul>
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">{text}</div>;
}
