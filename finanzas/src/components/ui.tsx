"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IChevL, IChevR, IClose } from "./Icons";
import { addMonths, currentYM, monthLabel, ymKey, type YM } from "@/lib/format";

// ------------------------------------------------------------------
//  Hoja que sube desde abajo (como en las apps de iPhone)
// ------------------------------------------------------------------
export function Sheet({
  open, onClose, title, children, footer, full,
}: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; full?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open || !mounted) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={"sheet" + (full ? " full" : "")} role="dialog" aria-modal="true">
        <div className="grab" />
        {title !== undefined && (
          <div className="head">
            <h2 className="title" style={{ fontSize: 14 }}>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><IClose size={18} /></button>
          </div>
        )}
        <div className="body">{children}</div>
        {footer && <div className="foot">{footer}</div>}
      </div>
    </>,
    document.body
  );
}

// ------------------------------------------------------------------
//  Fila que se desliza hacia la izquierda para mostrar acciones
// ------------------------------------------------------------------
export interface SwipeAction { label: string; color: string; icon?: ReactNode; onClick: () => void }

let closeOpenRow: (() => void) | null = null;

export function SwipeRow({ actions, children, onTap }: { actions: SwipeAction[]; children: ReactNode; onTap?: () => void }) {
  const width = actions.length * 76;
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const st = useRef({ sx: 0, sy: 0, base: 0, lock: "" as "" | "h" | "v", moved: false });

  const close = () => setX(0);

  const onStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    st.current = { sx: t.clientX, sy: t.clientY, base: x, lock: "", moved: false };
    if (closeOpenRow && closeOpenRow !== close) { closeOpenRow(); closeOpenRow = null; }
  };
  const onMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - st.current.sx;
    const dy = t.clientY - st.current.sy;
    if (!st.current.lock) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      st.current.lock = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (st.current.lock !== "h") return;
    st.current.moved = true;
    setDrag(true);
    const nx = Math.min(0, Math.max(-width - 30, st.current.base + dx));
    setX(nx);
  };
  const onEnd = () => {
    setDrag(false);
    if (st.current.lock !== "h") return;
    const open = x < -width / 2.5;
    setX(open ? -width : 0);
    if (open) closeOpenRow = close;
  };

  return (
    <div className="swipe">
      <div className="actions" style={{ width }}>
        {actions.map((a) => (
          <button key={a.label} style={{ background: a.color }} onClick={() => { close(); a.onClick(); }}>
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div
        className={"fg" + (drag ? " dragging" : "")}
        style={{ transform: `translateX(${x}px)` }}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onClick={() => {
          if (st.current.moved) { st.current.moved = false; return; }
          if (x !== 0) { close(); return; }
          onTap?.();
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
//  Selector de mes  ‹ Noviembre 2026 ›
// ------------------------------------------------------------------
export function MonthNav({ value, onChange }: { value: YM; onChange: (v: YM) => void }) {
  const isCurrent = ymKey(value) >= ymKey(currentYM());
  return (
    <div className="month-nav">
      <button onClick={() => onChange(addMonths(value, -1))} aria-label="Mes anterior"><IChevL size={18} /></button>
      <span className="m">{monthLabel(value)}</span>
      <button onClick={() => onChange(addMonths(value, 1))} disabled={isCurrent} aria-label="Mes siguiente"><IChevR size={18} /></button>
    </div>
  );
}

// ------------------------------------------------------------------
//  Aviso corto
// ------------------------------------------------------------------
let showToastFn: ((m: string) => void) | null = null;
export const toast = (m: string) => showToastFn?.(m);

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    showToastFn = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2400); };
    return () => { showToastFn = null; clearTimeout(t); };
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; cls?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} type="button" className={(value === o.value ? "on " : "") + (o.cls ?? "")} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function initials(name: string) {
  const w = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}
