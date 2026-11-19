"use client";

import { money, moneyShort } from "@/lib/format";
import type { CatSlice } from "@/lib/stats";

export interface MonthBar { label: string; income: number; expense: number; profit: number; current?: boolean }

/** Barras de ingresos y egresos por mes + utilidad encima */
export function MonthBars({ data, onPick }: { data: MonthBar[]; onPick?: (i: number) => void }) {
  const W = 340, H = 190, top = 26, bottom = 24;
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const colW = W / data.length;
  const bw = Math.min(16, colW / 3.2);
  const y = (v: number) => top + (H - top - bottom) * (1 - v / max);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Utilidad por mes">
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        {data.map((d, i) => {
          const cx = colW * i + colW / 2;
          return (
            <g key={i} onClick={() => onPick?.(i)} style={{ cursor: onPick ? "pointer" : undefined }}>
              <rect x={colW * i} y={0} width={colW} height={H} fill="transparent" />
              {d.current && <rect x={colW * i + 3} y={4} width={colW - 6} height={H - 6} rx={10} fill="var(--surface)" />}
              <rect x={cx - bw - 1.5} y={y(d.income)} width={bw} height={Math.max(0, H - bottom - y(d.income))} rx={4} fill="var(--petrol)" />
              <rect x={cx + 1.5} y={y(d.expense)} width={bw} height={Math.max(0, H - bottom - y(d.expense))} rx={4} fill="var(--olive)" opacity={0.75} />
              <text x={cx} y={16} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={d.profit < 0 ? "var(--expense)" : "var(--petrol-deep)"}>
                {d.income || d.expense ? moneyShort(d.profit) : ""}
              </text>
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="11" fill={d.current ? "var(--ink)" : "var(--muted)"} fontWeight={d.current ? 700 : 400}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-legend">
        <span><i style={{ background: "var(--petrol)" }} />Ingresos</span>
        <span><i style={{ background: "var(--olive)", opacity: 0.75 }} />Egresos</span>
        <span style={{ fontWeight: 700, color: "var(--petrol-deep)" }}>$ = utilidad</span>
      </div>
    </div>
  );
}

/** Dona de distribución por categoría */
export function Donut({ data, total, label }: { data: CatSlice[]; total: number; label: string }) {
  const R = 70, r = 48, C = 90;
  let acc = 0;
  const arcs = data.map((s) => {
    const a0 = (acc / total) * Math.PI * 2;
    acc += s.value;
    const a1 = (acc / total) * Math.PI * 2;
    return { s, a0, a1 };
  });
  const pt = (a: number, rad: number) => [C + rad * Math.sin(a), C - rad * Math.cos(a)];
  const path = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r);
    return `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`;
  };
  return (
    <svg viewBox="0 0 180 180" width="170" height="170" role="img" aria-label={label}>
      {total > 0 ? arcs.map(({ s, a0, a1 }) => <path key={s.id} d={path(a0, a1)} fill={s.color} stroke="#fff" strokeWidth="1.5" />) : <circle cx={C} cy={C} r={(R + r) / 2} stroke="var(--surface-2)" strokeWidth={R - r} fill="none" />}
      <text x={C} y={C - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">{label}</text>
      <text x={C} y={C + 13} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)">{moneyShort(total)}</text>
    </svg>
  );
}

export function CatBars({ data, total }: { data: CatSlice[]; total: number }) {
  return (
    <div>
      {data.map((s) => (
        <div className="bar-row" key={s.id}>
          <div className="top">
            <span className="n"><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: s.color, marginRight: 7 }} />{s.name}</span>
            <span className="num" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              {money(s.value)} <span className="muted" style={{ fontWeight: 400 }}>{total ? Math.round((s.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${total ? (s.value / total) * 100 : 0}%`, background: s.color }} /></div>
        </div>
      ))}
    </div>
  );
}
