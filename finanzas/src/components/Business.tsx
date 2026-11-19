"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { money } from "@/lib/format";
import { IChevD, IGrid, IChevR } from "./Icons";
import { Sheet, initials } from "./ui";

export function BizDot({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  return (
    <span className="biz-dot" style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

export const GLOBAL_COLOR = "#0f1a19";

/** Pastilla de arriba para cambiar de negocio (equivalente a "Espacios" en Lukas) */
export function BusinessSwitcher() {
  const { active, businesses, accounts, balances, toCOP, setActiveId, activeId } = useData();
  const [open, setOpen] = useState(false);

  const totalOf = (bid: string | null) =>
    accounts.filter((a) => !bid || a.business_id === bid).reduce((s, a) => s + toCOP(balances[a.id] ?? 0, a.currency), 0);

  const pick = (id: string | null) => { setActiveId(id); setOpen(false); };

  return (
    <>
      <button className="biz-pill" onClick={() => setOpen(true)}>
        {active ? <BizDot name={active.name} color={active.color} /> : <span className="biz-dot" style={{ background: GLOBAL_COLOR }}><IGrid size={13} /></span>}
        <span className="name">{active?.name ?? "Global"}</span>
        <IChevD size={16} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Negocios">
        <div className="list">
          <button className="row link" onClick={() => pick(null)}>
            <span className="ico" style={{ background: GLOBAL_COLOR, color: "#fff" }}><IGrid size={18} /></span>
            <div className="main">
              <div className="t1">Global</div>
              <div className="t2">Todos los negocios juntos</div>
            </div>
            <div className="amt num">{money(totalOf(null))}</div>
            {activeId === null && <Check />}
          </button>
          {businesses.map((b) => (
            <button key={b.id} className="row link" onClick={() => pick(b.id)}>
              <BizDot name={b.name} color={b.color} size={40} />
              <div className="main">
                <div className="t1">{b.name}</div>
                <div className="t2">
                  {accounts.filter((a) => a.business_id === b.id).length} cuentas
                  {b.partner_share > 0 ? ` · socio ${b.partner_share}%` : ""}
                </div>
              </div>
              <div className="amt num">{money(totalOf(b.id))}</div>
              {activeId === b.id && <Check />}
            </button>
          ))}
        </div>
        <Link href="/mas/negocios" onClick={() => setOpen(false)} className="row link" style={{ marginTop: 12, borderRadius: 16, background: "var(--surface)" }}>
          <span className="main" style={{ fontWeight: 600 }}>Administrar negocios y categorías</span>
          <IChevR size={18} className="chev" />
        </Link>
        <p className="muted small" style={{ textAlign: "center", marginTop: 14 }}>
          Tip: en Inicio desliza la tarjeta verde a la izquierda o derecha para cambiar de negocio.
        </p>
      </Sheet>
    </>
  );
}

function Check() {
  return (
    <span style={{ width: 22, height: 22, borderRadius: 11, background: "var(--petrol)", color: "#fff", display: "grid", placeItems: "center", flex: "none" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m5 12 5 5 9-10" /></svg>
    </span>
  );
}
