"use client";

import { useState } from "react";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import type { Business, CatKind } from "@/lib/types";
import { BackBar } from "@/components/BackBar";
import { BizDot } from "@/components/Business";
import { Seg, Sheet, toast } from "@/components/ui";
import { IPlus, IChevR, IEdit, IArchive } from "@/components/Icons";
import { AccountSheet } from "@/components/TxForm";

const COLORS = ["#1E5B5A", "#6E7B3C", "#2F7F86", "#A88A3D", "#3C4F63", "#B0703F", "#4E6E66", "#5B4E7A", "#8C2F39", "#2D3B3A"];

export default function Businesses() {
  const { allBusinesses, categories } = useData();
  const [editing, setEditing] = useState<Business | "new" | null>(null);

  return (
    <main className="page">
      <BackBar title="Negocios" right={<button className="btn small" onClick={() => setEditing("new")}><IPlus size={18} /> Nuevo</button>} />
      <p className="muted small" style={{ margin: "-6px 2px 14px" }}>Cada negocio tiene sus propias categorías y su propia utilidad. Puedes agregar más, por ejemplo un negocio de cambio de aceite.</p>

      <div className="list">
        {allBusinesses.map((b) => (
          <button key={b.id} className={"row link" + (b.archived ? " disabled" : "")} onClick={() => setEditing(b)}>
            <BizDot name={b.name} color={b.color} size={40} />
            <div className="main">
              <div className="t1">{b.name}</div>
              <div className="t2">
                {categories.filter((c) => c.business_id === b.id && !c.archived).length} categorías
                {b.partner_share > 0 ? ` · ${b.partner_name || "socio"} ${b.partner_share}%` : ""}
                {b.archived ? " · archivado" : ""}
              </div>
            </div>
            <IChevR size={18} className="chev" />
          </button>
        ))}
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} full title={editing === "new" ? "Nuevo negocio" : "Editar negocio"}>
        {editing !== null && <BusinessForm key={editing === "new" ? "new" : editing.id} biz={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </main>
  );
}

function BusinessForm({ biz, onDone }: { biz: Business | null; onDone: () => void }) {
  const { categories, allBusinesses, bump, accById } = useData();
  const [profitAcc, setProfitAcc] = useState<string | null>(biz?.profit_account_id ?? null);
  const [pickAcc, setPickAcc] = useState(false);
  const [name, setName] = useState(biz?.name ?? "");
  const [color, setColor] = useState(biz?.color ?? COLORS[allBusinesses.length % COLORS.length]);
  const [hasPartner, setHasPartner] = useState((biz?.partner_share ?? 0) > 0);
  const [partnerName, setPartnerName] = useState(biz?.partner_name ?? "");
  const [share, setShare] = useState(String(biz?.partner_share || 40));
  const [kind, setKind] = useState<CatKind>("expense");
  const [newCat, setNewCat] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);

  const cats = categories.filter((c) => c.business_id === biz?.id && c.kind === kind && (showArchived || !c.archived));

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const row = {
      name: name.trim(),
      color,
      partner_name: hasPartner ? partnerName.trim() || "Socio" : null,
      partner_share: hasPartner ? Math.min(100, Math.max(0, Number(share.replace(",", ".")) || 0)) : 0,
      ...(biz ? { profit_account_id: profitAcc } : {}),
    };
    if (biz) {
      const { error } = await sb().from("businesses").update(row).eq("id", biz.id);
      setBusy(false);
      if (error) return toast(errorText(error));
      toast("Negocio actualizado");
      bump();
      onDone();
    } else {
      const { data, error } = await sb().from("businesses").insert({ ...row, sort: allBusinesses.length + 1 }).select().single();
      if (error) { setBusy(false); return toast(errorText(error)); }
      // categorías básicas para empezar
      const base: Record<string, unknown>[] = [
        { kind: "income", name: "Ventas", sort: 1 }, { kind: "income", name: "Otros", sort: 2 },
        { kind: "expense", name: "Compras e insumos", sort: 1 }, { kind: "expense", name: "Publicidad", sort: 2 },
        { kind: "expense", name: "Arriendo y servicios", sort: 3 }, { kind: "expense", name: "Nómina y comisiones", sort: 4 },
        { kind: "expense", name: "Otros", sort: 5 },
      ].map((c) => ({ ...c, business_id: data.id }));
      if (hasPartner) base.push({ kind: "expense", name: "Utilidad socio", sort: 6, business_id: data.id, special: "partner_payout" });
      await sb().from("categories").insert(base);
      setBusy(false);
      toast("Negocio creado");
      bump();
      onDone();
    }
  };

  const addCat = async () => {
    if (!biz || !newCat.trim()) return;
    const sort = Math.max(0, ...categories.filter((c) => c.business_id === biz.id && c.kind === kind).map((c) => c.sort)) + 1;
    const { error } = await sb().from("categories").insert({ business_id: biz.id, kind, name: newCat.trim(), sort });
    if (error) return toast(errorText(error));
    setNewCat("");
    bump();
  };

  const renameCat = async (id: string, old: string) => {
    const n = prompt("Nuevo nombre de la categoría", old);
    if (!n || !n.trim() || n === old) return;
    const { error } = await sb().from("categories").update({ name: n.trim() }).eq("id", id);
    if (error) return toast(errorText(error));
    bump();
  };

  const toggleCat = async (id: string, archived: boolean) => {
    const { error } = await sb().from("categories").update({ archived: !archived }).eq("id", id);
    if (error) return toast(errorText(error));
    toast(archived ? "Categoría activada" : "Categoría ocultada");
    bump();
  };

  const archiveBiz = async () => {
    if (!biz) return;
    if (!biz.archived && !confirm(`¿Archivar ${biz.name}? Deja de aparecer, pero su historial se conserva.`)) return;
    const { error } = await sb().from("businesses").update({ archived: !biz.archived }).eq("id", biz.id);
    if (error) return toast(errorText(error));
    bump();
    onDone();
  };

  return (
    <div>
      <div className="field">
        <label>Nombre</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Cambio de aceite" />
      </div>
      <div className="field">
        <span className="lbl">Color</span>
        <div className="swatches">
          {COLORS.map((c) => <button key={c} className={"swatch" + (color === c ? " on" : "")} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}
        </div>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink)" }}>
          <input type="checkbox" checked={hasPartner} onChange={(e) => setHasPartner(e.target.checked)} /> Tengo un socio en este negocio
        </label>
      </div>
      {hasPartner && (
        <div className="grid2">
          <div className="field"><label>Nombre del socio</label><input className="input" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Socio" /></div>
          <div className="field"><label>% de la utilidad</label><input className="input num" inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value.replace(/[^\d,.]/g, ""))} /></div>
        </div>
      )}
      {biz && (
        <div className="field">
          <span className="lbl">Bolsillo de ganancias</span>
          <button type="button" className="picker" onClick={() => setPickAcc(true)}>
            <span className={accById(profitAcc) ? "v" : "ph"}>{accById(profitAcc)?.name ?? "Elegir bolsillo"}</span>
            <IChevR size={18} className="chev" />
          </button>
          <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>Cuando vendas algo de este negocio, la app te propone pasar la ganancia aquí.</p>
          <AccountSheet open={pickAcc} currency="COP" onClose={() => setPickAcc(false)} onPick={(a) => { setProfitAcc(a.id); setPickAcc(false); }} />
        </div>
      )}
      <button className="btn" disabled={busy || !name.trim()} onClick={save}>{busy ? "Guardando…" : biz ? "Guardar cambios" : "Crear negocio"}</button>

      {biz && (
        <>
          <h3 className="h-section">Categorías</h3>
          <Seg value={kind} onChange={setKind} options={[{ value: "expense", label: "Egresos", cls: "expense" }, { value: "income", label: "Ingresos", cls: "income" }]} />
          <div className="list" style={{ marginTop: 10 }}>
            {cats.map((c) => (
              <div key={c.id} className={"row" + (c.archived ? " disabled" : "")} style={{ minHeight: 52 }}>
                <div className="main"><div className="t1" style={{ fontWeight: 500 }}>{c.name}</div>{c.special === "partner_payout" && <div className="t2">Pago de utilidad al socio</div>}</div>
                <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => renameCat(c.id, c.name)} aria-label="Renombrar"><IEdit size={16} /></button>
                <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => toggleCat(c.id, c.archived)} aria-label={c.archived ? "Activar" : "Ocultar"}><IArchive size={16} /></button>
              </div>
            ))}
            <div className="row" style={{ gap: 8 }}>
              <input className="input" style={{ height: 42 }} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={`Nueva categoría de ${kind === "income" ? "ingreso" : "egreso"}`} onKeyDown={(e) => e.key === "Enter" && addCat()} />
              <button className="btn small" onClick={addCat} disabled={!newCat.trim()}><IPlus size={18} /></button>
            </div>
          </div>
          <button className="link-btn" style={{ display: "block", margin: "12px auto 0" }} onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Ocultar categorías ocultas" : "Ver categorías ocultas"}
          </button>
          <button className="btn secondary" style={{ marginTop: 22 }} onClick={archiveBiz}>{biz.archived ? "Reactivar negocio" : "Archivar negocio"}</button>
        </>
      )}
    </div>
  );
}
