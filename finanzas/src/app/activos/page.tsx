"use client";

import { useState } from "react";
import { useData } from "@/lib/store";
import { money } from "@/lib/format";
import type { Asset } from "@/lib/types";
import { BizDot } from "@/components/Business";
import { TopBar } from "@/components/TopBar";
import { Sheet } from "@/components/ui";
import { AssetForm, AssetRow, SellForm, mineOf, profitOf, saleOf } from "@/components/Assets";
import { IPlus, ITarget } from "@/components/Icons";

export default function AssetsPage() {
  const { assets, allAssets, activeId, active, businesses, setActiveId, accById } = useData();
  // en el negocio de capital (Inversiones JH) se ven los activos comprados con su plata
  const inScope = (a: Asset) => !activeId || a.business_id === activeId || accById(a.funding_account_id ?? null)?.business_id === activeId;
  const [editing, setEditing] = useState<Asset | "new" | null>(null);
  const [selling, setSelling] = useState<Asset | null>(null);
  const [showSold, setShowSold] = useState(false);

  const list = assets.filter(inScope);
  const sold = allAssets.filter((a) => a.status === "sold" && inScope(a));

  const cost = list.reduce((s, a) => s + a.cost, 0);
  const sale = list.reduce((s, a) => s + saleOf(a), 0);
  const profit = list.reduce((s, a) => s + profitOf(a), 0);
  const others = list.reduce((s, a) => s + (a.partner_amount ?? 0), 0);
  const mine = list.reduce((s, a) => s + mineOf(a), 0);

  // agrupados por negocio
  const groups = businesses
    .map((b) => ({ b, items: list.filter((a) => a.business_id === b.id) }))
    .filter((g) => g.items.length);

  return (
    <main className="page">
      <TopBar right={<button className="icon-btn" onClick={() => setEditing("new")} aria-label="Nuevo activo"><IPlus size={20} /></button>} />
      <h1 className="title" style={{ margin: "6px 2px 14px" }}>Activos</h1>

      <section className="hero" style={{ paddingBottom: 16 }}>
        <div className="label">{active ? `Activos de ${active.name}` : "Tus activos"} · posible venta</div>
        <div className="big num">{money(sale)}</div>
        <div className="sub">Invertido (precio costo): {money(cost)}</div>
        <div className="pills">
          <div className="pill"><div className="k">Utilidad esperada</div><div className="v num">{money(profit, "COP", { sign: true })}</div></div>
          <div className="pill"><div className="k">Tu parte de la venta</div><div className="v num">{money(mine)}</div></div>
        </div>
        {others > 0 && <div className="sub" style={{ marginTop: 10 }}>De otras personas: {money(others)}</div>}
      </section>

      {!list.length && assets.length > 0 && (
        <div className="empty">
          <div className="big-ico"><ITarget size={28} /></div>
          <b>{active?.name} no tiene activos</b>
          Tienes {assets.length} {assets.length === 1 ? "activo" : "activos"} en otros negocios.
          <div style={{ marginTop: 14 }}><button className="btn small" onClick={() => setActiveId(null)}>Ver todos los negocios</button></div>
        </div>
      )}

      {!assets.length && (
        <div className="empty">
          <div className="big-ico"><ITarget size={28} /></div>
          <b>Sin activos todavía</b>
          Agrega carros, motos, oro o inventario con su precio costo y lo que esperas venderlos.
          <div style={{ marginTop: 14 }}><button className="btn small" onClick={() => setEditing("new")}><IPlus size={16} /> Agregar activo</button></div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.b.id}>
          <h3 className="h-section">
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><BizDot name={g.b.name} color={g.b.color} size={18} />{g.b.name}</span>
            <span className="num" style={{ fontFamily: "var(--body)", letterSpacing: 0, fontSize: 13, color: "var(--ink)", fontWeight: 700 }}>{money(g.items.reduce((s, a) => s + saleOf(a), 0))}</span>
          </h3>
          <div className="list">{g.items.map((a) => <AssetRow key={a.id} a={a} onOpen={() => setEditing(a)} />)}</div>
          <p className="muted xsmall num" style={{ margin: "6px 4px 0", textAlign: "right" }}>
            Costo {money(g.items.reduce((s, a) => s + a.cost, 0))} · utilidad esperada {money(g.items.reduce((s, a) => s + profitOf(a), 0), "COP", { sign: true })}
          </p>
        </div>
      ))}

      {sold.length > 0 && (
        <>
          <button className="link-btn" style={{ display: "block", margin: "18px auto 0" }} onClick={() => setShowSold(!showSold)}>
            {showSold ? "Ocultar vendidos" : `Ver vendidos (${sold.length})`}
          </button>
          {showSold && (
            <div className="list" style={{ marginTop: 10 }}>
              {sold.map((a) => (
                <button key={a.id} className="row link" onClick={() => setEditing(a)}>
                  <div className="main"><div className="t1">{a.name}</div><div className="t2">Vendido {a.sold_date} · costo {money(a.cost)}</div></div>
                  <div className="amt num" style={{ color: "var(--income)" }}>{money(a.sold_price)}<span className="s">utilidad {money((a.sold_price ?? 0) - a.cost)}</span></div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} full title={editing === "new" ? "Nuevo activo" : "Editar activo"}>
        {editing !== null && (
          <AssetForm
            key={editing === "new" ? "new" : editing.id}
            asset={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
            onSell={() => { if (editing !== "new") { setSelling(editing); setEditing(null); } }}
          />
        )}
      </Sheet>
      <Sheet open={!!selling} onClose={() => setSelling(null)} full title={selling ? `Vender ${selling.name}` : ""}>
        {selling && <SellForm key={selling.id} asset={selling} onDone={() => setSelling(null)} />}
      </Sheet>
    </main>
  );
}
