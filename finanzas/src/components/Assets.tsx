"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, formatTyping, money, parseAmount, todayISO } from "@/lib/format";
import { ASSET_CATEGORIES, type Asset } from "@/lib/types";
import { Sheet, toast } from "./ui";
import { AccountSheet } from "./TxForm";
import { AccountIcon } from "./AccountIcon";
import { IChevR } from "./Icons";

export const saleOf = (a: Asset) => a.sale_price ?? a.cost;
export const profitOf = (a: Asset) => saleOf(a) - a.cost;
/** lo que es tuyo de la venta (descontando la parte de otra persona) */
export const mineOf = (a: Asset) => saleOf(a) - (a.partner_amount ?? 0);
/** lo que es tuyo a precio costo */
export const mineAtCost = (a: Asset) => a.cost - (a.partner_amount ?? 0);

export function AssetRow({ a, onOpen }: { a: Asset; onOpen: () => void }) {
  const { bizById } = useData();
  const b = bizById(a.business_id);
  const p = profitOf(a);
  const pct = a.cost ? Math.round((p / a.cost) * 100) : 0;
  return (
    <button className="row link" style={{ alignItems: "flex-start" }} onClick={onOpen}>
      <div className="main">
        <div className="t1">{a.name}</div>
        <div className="t2">{[a.detail, b?.name, a.status === "sold" ? "vendido" : null].filter(Boolean).join(" · ")}</div>
        <div className="xsmall muted num" style={{ marginTop: 4 }}>
          Costo {money(a.cost)} → Venta {money(saleOf(a))}
        </div>
        {a.partner_name && a.partner_amount ? (
          <span className="tag" style={{ marginTop: 5 }}>{money(a.partner_amount)} de {a.partner_name}</span>
        ) : null}
      </div>
      <div className="amt num" style={{ color: p < 0 ? "var(--expense)" : "var(--income)" }}>
        {money(p, "COP", { sign: true })}
        <span className="s">{pct}% utilidad</span>
      </div>
    </button>
  );
}

// ------------------------------------------------------------------
//  Crear / editar activo
// ------------------------------------------------------------------
export function AssetForm({ asset, onDone, onSell }: { asset: Asset | null; onDone: () => void; onSell: () => void }) {
  const { businesses, activeId, allAssets, bump } = useData();
  const [name, setName] = useState(asset?.name ?? "");
  const [category, setCategory] = useState(asset?.category ?? "Vehículo");
  const [businessId, setBusinessId] = useState(asset?.business_id ?? activeId ?? businesses[0]?.id);
  const [cost, setCost] = useState(amountToInput(asset?.cost ?? 0));
  const [sale, setSale] = useState(amountToInput(asset?.sale_price ?? 0));
  const [detail, setDetail] = useState(asset?.detail ?? "");
  const [hasPartner, setHasPartner] = useState(!!asset?.partner_name);
  const [partnerName, setPartnerName] = useState(asset?.partner_name ?? "");
  const [partnerAmount, setPartnerAmount] = useState(amountToInput(asset?.partner_amount ?? 0));
  const [note, setNote] = useState(asset?.note ?? "");
  const [date, setDate] = useState(asset?.acquired_date ?? "");
  const [busy, setBusy] = useState(false);

  const c = parseAmount(cost), s = parseAmount(sale), pa = hasPartner ? parseAmount(partnerAmount) : 0;
  const valid = name.trim() && businessId && c >= 0;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const row = {
      name: name.trim(), category, business_id: businessId, cost: c, sale_price: s || null,
      detail: detail.trim() || null, note: note.trim() || null, acquired_date: date || null,
      partner_name: hasPartner ? partnerName.trim() || "Socio" : null, partner_amount: hasPartner ? pa || null : null,
    };
    const { error } = asset
      ? await sb().from("assets").update(row).eq("id", asset.id)
      : await sb().from("assets").insert({ ...row, sort: allAssets.length });
    setBusy(false);
    if (error) return toast(/assets/.test(error.message) ? "Falta actualizar la base de datos (06-activos.sql)." : errorText(error));
    toast(asset ? "Activo actualizado" : "Activo agregado");
    bump();
    onDone();
  };

  const remove = async () => {
    if (!asset || !confirm(`¿Borrar "${asset.name}"? Esto no borra movimientos ya registrados.`)) return;
    const { error } = await sb().from("assets").delete().eq("id", asset.id);
    if (error) return toast(errorText(error));
    toast("Activo borrado");
    bump();
    onDone();
  };

  const reactivate = async () => {
    if (!asset) return;
    const { error } = await sb().from("assets").update({ status: "active", sold_price: null, sold_date: null }).eq("id", asset.id);
    if (error) return toast(errorText(error));
    toast("El activo volvió a la lista (los movimientos de la venta no se borran)");
    bump();
    onDone();
  };

  return (
    <div>
      <div className="field">
        <label htmlFor="as-name">Nombre</label>
        <input id="as-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Mazda CX-30 Grand Touring LX" />
      </div>
      <div className="field">
        <span className="lbl">Tipo</span>
        <div className="chips">
          {ASSET_CATEGORIES.map((x) => <button key={x} type="button" className={"chip" + (category === x ? " on" : "")} onClick={() => setCategory(x)}>{x}</button>)}
        </div>
      </div>
      <div className="field">
        <span className="lbl">¿De qué negocio es?</span>
        <div className="chips scroll">
          {businesses.map((b) => <button key={b.id} type="button" className={"chip" + (businessId === b.id ? " on" : "")} onClick={() => setBusinessId(b.id)}>{b.name}</button>)}
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="as-cost">Precio costo</label>
          <input id="as-cost" className="input num" inputMode="numeric" value={cost} onChange={(e) => setCost(formatTyping(e.target.value))} placeholder="0" />
        </div>
        <div className="field">
          <label htmlFor="as-sale">Posible venta</label>
          <input id="as-sale" className="input num" inputMode="numeric" value={sale} onChange={(e) => setSale(formatTyping(e.target.value))} placeholder="0" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="as-detail">Detalle</label>
        <input id="as-detail" className="input" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Ej. modelo 2023, placa, 15 gramos 18K…" />
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
          <input type="checkbox" checked={hasPartner} onChange={(e) => setHasPartner(e.target.checked)} /> Una parte es de otra persona
        </label>
      </div>
      {hasPartner && (
        <div className="grid2">
          <div className="field"><label htmlFor="as-pn">¿De quién?</label><input id="as-pn" className="input" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Ej. Paula (hermana)" /></div>
          <div className="field"><label htmlFor="as-pa">¿Cuánto le toca?</label><input id="as-pa" className="input num" inputMode="numeric" value={partnerAmount} onChange={(e) => setPartnerAmount(formatTyping(e.target.value))} placeholder="0" /></div>
        </div>
      )}
      <div className="grid2">
        <div className="field"><label htmlFor="as-date">Fecha de compra</label><input id="as-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="as-note">Nota</label><input id="as-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></div>
      </div>

      {c > 0 && (
        <div className="card soft" style={{ marginBottom: 14 }}>
          <div className="split" style={{ paddingTop: 0 }}><span className="muted">Utilidad esperada</span><b className="num" style={{ color: (s || c) - c < 0 ? "var(--expense)" : "var(--income)" }}>{money((s || c) - c, "COP", { sign: true })}</b></div>
          {pa > 0 && <div className="split"><span className="muted">Tu parte de la venta</span><b className="num">{money((s || c) - pa)}</b></div>}
        </div>
      )}

      <button className="btn" disabled={!valid || busy} onClick={save}>{busy ? "Guardando…" : asset ? "Guardar cambios" : "Agregar activo"}</button>
      {asset && asset.status === "active" && <button className="btn secondary" style={{ marginTop: 10 }} onClick={onSell}>Marcar como vendido</button>}
      {asset && asset.status === "sold" && <button className="btn secondary" style={{ marginTop: 10 }} onClick={reactivate}>Volver a ponerlo en venta</button>}
      {asset && <button className="btn danger" style={{ marginTop: 10 }} onClick={remove}>Borrar activo</button>}
    </div>
  );
}

// ------------------------------------------------------------------
//  Marcar vendido: registra la plata que entró y la parte del socio
// ------------------------------------------------------------------
export function SellForm({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  const { accounts, accById, categories, bump, bizById } = useData();
  const [price, setPrice] = useState(amountToInput(saleOf(asset)));
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | undefined>(accounts.find((a) => a.business_id === asset.business_id && a.type !== "card")?.id);
  const [mode, setMode] = useState<"profit" | "full" | "none">("profit");
  const [partnerDebt, setPartnerDebt] = useState(!!asset.partner_amount);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const acc = accById(accountId);
  const value = parseAmount(price);
  const profit = value - asset.cost;
  const saleCat = useMemo(
    () => categories.find((c) => c.business_id === asset.business_id && c.kind === "income" && /venta/i.test(c.name)) ??
      categories.find((c) => c.business_id === asset.business_id && c.kind === "income"),
    [categories, asset.business_id]
  );

  const save = async () => {
    if (!value) return;
    if (mode !== "none" && !acc) return toast("Elige la cuenta donde entró la plata");
    setBusy(true);
    const c = sb();
    const txs: Record<string, unknown>[] = [];
    const base = { date, account_id: acc?.id, business_id: asset.business_id };
    if (mode === "full") {
      txs.push({ ...base, kind: "income", amount: value, category_id: saleCat?.id ?? null, description: `Venta ${asset.name}` });
    } else if (mode === "profit") {
      // la parte que era costo vuelve como capital (no es ingreso); solo la utilidad es ingreso
      const capital = Math.min(value, asset.cost);
      if (capital > 0) txs.push({ ...base, kind: "debt_in", amount: capital, description: `Recuperación de capital · ${asset.name}` });
      if (profit > 0) txs.push({ ...base, kind: "income", amount: profit, category_id: saleCat?.id ?? null, description: `Utilidad venta ${asset.name}` });
      if (profit < 0) txs.push({ ...base, kind: "expense", amount: -profit, description: `Pérdida venta ${asset.name}` });
    }
    if (txs.length) {
      const { error } = await c.from("transactions").insert(txs);
      if (error) { setBusy(false); return toast(errorText(error)); }
    }
    if (partnerDebt && asset.partner_amount && asset.partner_name) {
      await c.from("debts").insert({
        direction: "owe", person: asset.partner_name, description: `Su parte de la venta · ${asset.name}`,
        category: "Familia", business_id: asset.business_id, total_amount: asset.partner_amount, start_date: date,
      });
    }
    const { error } = await c.from("assets").update({ status: "sold", sold_price: value, sold_date: date }).eq("id", asset.id);
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(`¡Vendido! Utilidad ${money(profit)}`);
    bump();
    onDone();
  };

  return (
    <div>
      <div className="field">
        <label htmlFor="sell-price">Precio final de venta</label>
        <input id="sell-price" className="input num" inputMode="numeric" value={price} onChange={(e) => setPrice(formatTyping(e.target.value))} />
        <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>Costo {money(asset.cost)} → utilidad <b style={{ color: profit < 0 ? "var(--expense)" : "var(--income)" }}>{money(profit, "COP", { sign: true })}</b></p>
      </div>
      <div className="field"><label htmlFor="sell-date">Fecha</label><input id="sell-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></div>

      <div className="field">
        <span className="lbl">¿Cómo registro la plata?</span>
        <div className="list">
          {([
            ["profit", "Solo la utilidad como ingreso", "Recomendado si la compra no está registrada como gasto en la app. El costo vuelve como capital."],
            ["full", "Toda la venta como ingreso", "Úsalo si la compra ya la registraste como gasto (ej. Compra de vehículo)."],
            ["none", "No registrar plata", "Solo marcarlo como vendido."],
          ] as const).map(([v, t, d]) => (
            <button key={v} type="button" className="row link" onClick={() => setMode(v)} style={{ alignItems: "flex-start" }}>
              <input type="radio" readOnly checked={mode === v} style={{ marginTop: 4 }} />
              <div className="main"><div className="t1" style={{ whiteSpace: "normal" }}>{t}</div><div className="t2" style={{ whiteSpace: "normal" }}>{d}</div></div>
            </button>
          ))}
        </div>
      </div>
      {mode !== "none" && (
        <div className="field">
          <span className="lbl">¿A qué cuenta entró?</span>
          <button type="button" className="picker" onClick={() => setPick(true)}>
            {acc ? <><AccountIcon type={acc.type} size={34} /><span className="v">{acc.name}</span></> : <span className="ph">Elige la cuenta</span>}
            <IChevR size={18} className="chev" />
          </button>
        </div>
      )}
      {asset.partner_amount && asset.partner_name ? (
        <div className="field">
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
            <input type="checkbox" checked={partnerDebt} onChange={(e) => setPartnerDebt(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Anotar que le debo {money(asset.partner_amount)} a {asset.partner_name} (queda en Deudas → Yo debo)</span>
          </label>
        </div>
      ) : null}
      <button className="btn" disabled={!value || busy} onClick={save}>{busy ? "Guardando…" : "Marcar vendido"}</button>
      <p className="muted xsmall" style={{ marginTop: 10 }}>Negocio: {bizById(asset.business_id)?.name}</p>
      <AccountSheet open={pick} currency="COP" onClose={() => setPick(false)} onPick={(a) => { setAccountId(a.id); setPick(false); }} />
    </div>
  );
}
