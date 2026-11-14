import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart,
} from "recharts";
import type { Bar as PriceBar } from "@/lib/market";
import { money, pct, price as fmtPrice } from "@/lib/format";
import { useSettings } from "@/store";
import { useIsDark } from "@/hooks";

// Monochrome brand: categorical slots are grey steps in fixed order (alternating light and dark so neighbours separate). Identity is always backed by a legend or direct label, never by tone alone.
const SERIES_LIGHT = ["#0a0a0a", "#8a8a8a", "#4a4a4a", "#c4c4c4", "#6a6a6a", "#2e2e2e", "#a8a8a8", "#dcdcdc"];
const SERIES_DARK = ["#f5f5f5", "#6b6b6b", "#b0b0b0", "#3a3a3a", "#8e8e8e", "#d0d0d0", "#525252", "#2a2a2a"];
export const OTHER = "#8a8a8a";

export function useSeriesColors() {
  return useIsDark() ? SERIES_DARK : SERIES_LIGHT;
}

const axisTick = { fill: "rgb(var(--muted))", fontSize: 11 };

function TooltipBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-xl backdrop-blur">{children}</div>;
}

function fmtDate(t: number, intraday: boolean) {
  const d = new Date(t);
  return intraday
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

/** Single-series price/value chart with crosshair tooltip. Colour encodes direction over the range. */
export function PriceChart({
  data, height = 280, intraday = false, valueFormat = "price", compare,
}: {
  data: PriceBar[];
  height?: number;
  intraday?: boolean;
  valueFormat?: "price" | "money";
  compare?: { label: string; data: PriceBar[] };
}) {
  useSettings((s) => s.currency); // re-render on currency change
  const up = data.length > 1 && data[data.length - 1].close >= data[0].close;
  const color = up ? "rgb(var(--up))" : "rgb(var(--down))";
  const id = useMemo(() => "g" + Math.random().toString(36).slice(2), []);
  const fmt = (v: number) => (valueFormat === "money" ? money(v, { compact: true }) : fmtPrice(v));

  if (compare) {
    // Index both series to 100 so they share one axis.
    const base = data[0]?.close || 1;
    const cbase = compare.data[0]?.close || 1;
    const rows = data.map((b, i) => ({ t: b.t, a: (b.close / base) * 100, b: compare.data[i] ? (compare.data[i].close / cbase) * 100 : undefined }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="0" strokeOpacity={0.6} />
          <XAxis dataKey="t" tickFormatter={(t) => fmtDate(t, intraday)} tick={axisTick} axisLine={false} tickLine={false} minTickGap={48} />
          <YAxis domain={["auto", "auto"]} tick={axisTick} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => v.toFixed(0)} />
          <Tooltip
            cursor={{ stroke: "rgb(var(--muted))", strokeDasharray: "3 3" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox>
                  <div className="mb-1 text-muted">{fmtDate(payload[0].payload.t, intraday)}</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /> Portfolio <span className="num ml-auto font-medium">{pct(payload[0].payload.a / 100 - 1)}</span></div>
                  {payload[0].payload.b !== undefined && (
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: OTHER }} /> {compare.label} <span className="num ml-auto font-medium">{pct(payload[0].payload.b / 100 - 1)}</span></div>
                  )}
                </TooltipBox>
              ) : null
            }
          />
          <Line dataKey="b" stroke={OTHER} strokeWidth={1.5} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
          <Line dataKey="a" stroke="rgb(var(--accent))" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--surface))" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeOpacity={0.6} />
        <XAxis dataKey="t" tickFormatter={(t) => fmtDate(t, intraday)} tick={axisTick} axisLine={false} tickLine={false} minTickGap={48} />
        <YAxis domain={["auto", "auto"]} tick={axisTick} axisLine={false} tickLine={false} width={valueFormat === "money" ? 64 : 56} tickFormatter={fmt} orientation="right" />
        <Tooltip
          cursor={{ stroke: "rgb(var(--muted))", strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <div className="text-muted">{fmtDate(payload[0].payload.t, intraday)}</div>
                <div className="num mt-0.5 text-sm font-semibold">{valueFormat === "money" ? money(payload[0].payload.close) : fmtPrice(payload[0].payload.close)}</div>
                <div className="num text-[11px] text-muted">{pct(payload[0].payload.close / data[0].close - 1)} vs start</div>
              </TooltipBox>
            ) : null
          }
        />
        <Area dataKey="close" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--surface))" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data, width = 96, height = 32 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "rgb(var(--up))" : "rgb(var(--down))"} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Allocation donut. More than 7 slices fold into "Other" so hues are never cycled. */
export function Donut({ data, height = 220 }: { data: { name: string; value: number; weight: number }[]; height?: number }) {
  const colors = useSeriesColors();
  const slices = foldOther(data, 7);
  return (
    <div className="flex flex-col items-center gap-5">
      <div style={{ width: height, height }} className="shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={1.2} stroke="rgb(var(--surface))" strokeWidth={2} isAnimationActive={false}>
              {slices.map((s, i) => <Cell key={s.name} fill={s.name === "Other" ? OTHER : colors[i]} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox>
                    <div className="font-medium">{payload[0].name}</div>
                    <div className="num text-muted">{money(Number(payload[0].value))} · {pct(payload[0].payload.weight, 1, false)}</div>
                  </TooltipBox>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid w-full grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.name === "Other" ? OTHER : colors[i] }} />
            <span className="truncate">{s.name}</span>
            <span className="num ml-auto text-muted">{pct(s.weight, 1, false)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function foldOther<T extends { name: string; value: number; weight: number }>(data: T[], max: number) {
  if (data.length <= max + 1) return data;
  const head = data.slice(0, max);
  const rest = data.slice(max);
  return [...head, { name: "Other", value: rest.reduce((a, r) => a + r.value, 0), weight: rest.reduce((a, r) => a + r.weight, 0) } as T];
}

/** Horizontal diverging bars for returns (positive right / green, negative left / red). */
export function ReturnBars({ data, height }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke="rgb(var(--line))" strokeOpacity={0.6} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => pct(v, 0)} />
        <YAxis type="category" dataKey="name" tick={axisTick} axisLine={false} tickLine={false} width={88} />
        <Tooltip
          cursor={{ fill: "rgb(var(--elevated))" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <div className="font-medium">{payload[0].payload.name}</div>
                <div className="num">{pct(Number(payload[0].value))}</div>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="value" radius={4} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.name} fill={d.value >= 0 ? "rgb(var(--up))" : "rgb(var(--down))"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GrowthChart({ data, height = 260 }: { data: { year: number; contributed: number; interest: number }[]; height?: number }) {
  const colors = useSeriesColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeOpacity={0.6} />
        <XAxis dataKey="year" tick={axisTick} axisLine={false} tickLine={false} minTickGap={16} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => money(v, { compact: true, decimals: 0 })} />
        <Tooltip
          cursor={{ fill: "rgb(var(--elevated))" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox>
                <div className="mb-1 text-muted">Year {payload[0].payload.year}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: colors[0] }} />Contributed <span className="num ml-auto pl-3">{money(payload[0].payload.contributed, { decimals: 0 })}</span></div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: colors[2] }} />Growth <span className="num ml-auto pl-3">{money(payload[0].payload.interest, { decimals: 0 })}</span></div>
                <div className="mt-1 flex border-t border-line pt-1 font-medium">Balance <span className="num ml-auto">{money(payload[0].payload.contributed + payload[0].payload.interest, { decimals: 0 })}</span></div>
              </TooltipBox>
            ) : null
          }
        />
        <Bar dataKey="contributed" stackId="a" fill={colors[0]} isAnimationActive={false} stroke="rgb(var(--surface))" strokeWidth={1} />
        <Bar dataKey="interest" stackId="a" fill={colors[2]} radius={[4, 4, 0, 0]} isAnimationActive={false} stroke="rgb(var(--surface))" strokeWidth={1} />
      </BarChart>
    </ResponsiveContainer>
  );
}
