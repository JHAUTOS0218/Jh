"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, currentYM, formatTyping, money, monthRange, parseAmount, todayISO } from "@/lib/format";
import { ASSET_CATEGORIES, type Asset } from "@/lib/types";
import { Sheet, toast } from "./ui";
import { AccountSheet } from "./TxForm";
import { AccountIcon } from "./AccountIcon";
import { IChevR } from "./Icons";

/** tipo sugerido según el negocio */
export function defaultCategory(businessName?: string) {
  const n = (businessName ?? "").toLowerCase();
  if (n.includes("oro")) return "Prendas en oro";
  if (n.includes("bike") || n.includes("moto")) return "Moto";
  if (n.includes("auto")) return "Vehículo";
  return "Otro";
}

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
        <div className="t2">{[a.category, a.detail, a.status === "sold" ? "vendido" : null].filter(Boolean).join(" · ")}</div>
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
  const { businesses, activeId, allAssets, bump, accById, moneyAccounts } = useData();
  const capBiz = businesses.find((b) => /inversiones/i.test(b.name));
  const [fundId, setFundId] = useState<string | null>(asset ? asset.funding_account_id ?? null : moneyAccounts.find((a) => a.business_id === capBiz?.id && a.currency === "COP")?.id ?? null);
  const [payNow, setPayNow] = useState(false);
  const [pickFund, setPickFund] = useState(false);
  const [name, setName] = useState(asset?.name ?? "");
  const [businessId, setBusinessId] = useState(asset?.business_id ?? activeId ?? businesses[0]?.id);
  const [category, setCategory] = useState(asset?.category ?? defaultCategory(businesses.find((b) => b.id === (asset?.business_id ?? activeId ?? businesses[0]?.id))?.name));
  const [catTouched, setCatTouched] = useState(!!asset);
  const pickBusiness = (id: string) => {
    setBusinessId(id);
    if (!catTouched) setCategory(defaultCategory(businesses.find((b) => b.id === id)?.name));
  };
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
      funding_account_id: fundId,
    };
    const { error } = asset
      ? await sb().from("assets").update(row).eq("id", asset.id)
      : await sb().from("assets").insert({ ...row, sort: allAssets.length });
    if (!error && !asset && payNow && fundId && c - pa > 0) {
      // la plata sale de la cuenta con que se compró (no es gasto: es capital invertido)
      const r = await sb().from("transactions").insert({
        kind: "debt_out", date: date || todayISO(), amount: c - pa, account_id: fundId, business_id: businessId,
        status: "confirmed", description: `Compra ${name.trim()}`,
      });
      if (r.error) toast(errorText(r.error));
    }
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
          {ASSET_CATEGORIES.map((x) => <button key={x} type="button" className={"chip" + (category === x ? " on" : "")} onClick={() => { setCategory(x); setCatTouched(true); }}>{x}</button>)}
        </div>
      </div>
      <div className="field">
        <span className="lbl">¿De qué negocio es?</span>
        <div className="chips scroll">
          {businesses.map((b) => <button key={b.id} type="button" className={"chip" + (businessId === b.id ? " on" : "")} onClick={() => pickBusiness(b.id)}>{b.name}</button>)}
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

      <div className="field">
        <span className="lbl">¿Con qué plata se compró?</span>
        <button type="button" className="picker" onClick={() => setPickFund(true)}>
          <span className={accById(fundId) ? "v" : "ph"}>{accById(fundId)?.name ?? "Elegir cuenta o bolsillo"}</span>
          <IChevR size={18} className="chev" />
        </button>
        <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>Al venderlo, la app te propone devolver el costo ahí.</p>
      </div>
      {!asset && fundId && (
        <div className="field">
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
            <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Lo acabo de comprar: descontar {money(Math.max(0, c - pa))} de {accById(fundId)?.name}</span>
          </label>
        </div>
      )}
      <AccountSheet open={pickFund} currency="COP" onClose={() => setPickFund(false)} onPick={(a) => { setFundId(a.id); setPickFund(false); }} />

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
//  Vender: la plata entra al disponible y la app propone repartirla
// ------------------------------------------------------------------
type Line = { key: string; label: string; hint: string; to: string | null | undefined; amount: number };

export function SellForm({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  const { moneyAccounts, accById, categories, bump, bizById, settings, businesses } = useData();
  const biz = bizById(asset.business_id);
  const plan = settings.plan ?? {};
  const capitalAcc = businesses.find((b) => /inversiones/i.test(b.name));
  const fundingId = asset.funding_account_id ?? moneyAccounts.find((a) => a.business_id === capitalAcc?.id && a.currency === "COP")?.id ?? null;
  const officeAcc = accById(plan.office_account_id ?? null);
  const officePays = !!officeAcc && officeAcc.business_id === asset.business_id && (plan.office_monthly ?? 0) > 0;

  const [step, setStep] = useState<1 | 2>(1);
  const [price, setPrice] = useState(amountToInput(saleOf(asset)));
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState<string | undefined>(
    (moneyAccounts.find((a) => /disponible/i.test(a.name) && a.currency === "COP") ??
      moneyAccounts.find((a) => a.business_id === asset.business_id && a.currency === "COP"))?.id
  );
  const [record, setRecord] = useState(true);
  const [partnerDebt, setPartnerDebt] = useState(!!asset.partner_amount);
  const [officeDone, setOfficeDone] = useState(0);
  const [edits, setEdits] = useState<Record<string, string>>({});
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

  // lo que ya se pasó a la oficina este mes
  useEffect(() => {
    if (!officePays || !officeAcc) return;
    const { from, to } = monthRange(currentYM());
    sb().from("transactions").select("to_amount,amount").eq("kind", "transfer").eq("to_account_id", officeAcc.id).eq("status", "confirmed")
      .gte("date", from).lte("date", to)
      .then(({ data }) => setOfficeDone((data ?? []).reduce((t, r) => t + Number(r.to_amount ?? r.amount ?? 0), 0)));
  }, [officePays, officeAcc]);

  // propuesta de reparto
  const pa = Math.min(asset.partner_amount ?? 0, value);
  const bizShare = profit > 0 && biz?.partner_share ? Math.round((profit * biz.partner_share) / 100) : 0;
  const officeNeed = officePays ? Math.max(0, (plan.office_monthly ?? 0) - officeDone) : 0;
  const proposal: Line[] = [
    { key: "cost", label: "Costo de vuelta", hint: "Recupera la plata con que se compró", to: fundingId, amount: Math.max(0, Math.min(value, asset.cost) - pa) },
    ...(officePays ? [{ key: "office", label: "Oficina del mes", hint: officeDone ? `Ya tiene ${money(officeDone)} de ${money(plan.office_monthly ?? 0)} este mes` : `${money(plan.office_monthly ?? 0)} al mes`, to: officeAcc!.id, amount: Math.min(officeNeed, Math.max(0, profit - bizShare)) }] : []),
  ];
  const lines: Line[] = proposal.map((l) => ({ ...l, amount: edits[l.key] !== undefined ? parseAmount(edits[l.key]) : l.amount }));
  const used = lines.reduce((t, l) => t + l.amount, 0);
  const gain = Math.max(0, value - used - pa - bizShare);
  const profitTo = biz?.profit_account_id ?? null;
  lines.push({ key: "profit", label: "Ganancia", hint: profitTo ? "Para el bolsillo del negocio" : "Elige el bolsillo de ganancias en Más → Negocios", to: profitTo, amount: gain });
  const keep = value - lines.filter((l) => l.to && l.to !== accountId).reduce((t, l) => t + l.amount, 0);
  const over = used + pa + bizShare > value;

  const save = async () => {
    if (!value) return;
    if (record && !acc) return toast("Elige la cuenta donde entró la plata");
    if (record && over) return toast("El reparto suma más que la venta");
    setBusy(true);
    const c = sb();
    if (record && acc) {
      const base = { date, account_id: acc.id, business_id: asset.business_id, status: "confirmed" };
      const txs: Record<string, unknown>[] = [];
      // el costo vuelve como capital (no es ingreso); la utilidad sí es ingreso
      if (asset.cost > 0) txs.push({ ...base, kind: "debt_in", amount: asset.cost, description: `Recuperación de capital · ${asset.name}` });
      if (profit > 0) txs.push({ ...base, kind: "income", amount: profit, category_id: saleCat?.id ?? null, description: `Utilidad venta ${asset.name}` });
      if (profit < 0) txs.push({ ...base, kind: "expense", amount: -profit, description: `Pérdida venta ${asset.name}` });
      for (const l of lines) {
        if (!l.to || l.to === acc.id || l.amount <= 0) continue;
        txs.push({ date, kind: "transfer", account_id: acc.id, to_account_id: l.to, amount: l.amount, to_amount: l.amount, business_id: null, status: "confirmed", description: `${l.label} · venta ${asset.name}` });
      }
      const { error } = await c.from("transactions").insert(txs);
      if (error) { setBusy(false); return toast(errorText(error)); }
    }
    const debts: Record<string, unknown>[] = [];
    if (partnerDebt && pa > 0 && asset.partner_name)
      debts.push({ direction: "owe", person: asset.partner_name, description: `Su parte de la venta · ${asset.name}`, category: "Familia", business_id: asset.business_id, total_amount: pa, start_date: date });
    if (bizShare > 0)
      debts.push({ direction: "owe", person: biz?.partner_name || "Socio", description: `${biz?.partner_share}% de la utilidad · ${asset.name}`, category: "Otro", business_id: asset.business_id, total_amount: bizShare, start_date: date });
    if (debts.length) {
      const { error } = await c.from("debts").insert(debts);
      if (error) { setBusy(false); return toast(errorText(error)); }
    }
    const { error } = await c.from("assets").update({ status: "sold", sold_price: value, sold_date: date }).eq("id", asset.id);
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(`¡Vendido! Utilidad ${money(profit)}`);
    bump();
    onDone();
  };

  if (step === 1) return (
    <div>
      <div className="field">
        <label htmlFor="sell-price">Precio final de venta</label>
        <input id="sell-price" className="input num" inputMode="numeric" value={price} onChange={(e) => setPrice(formatTyping(e.target.value))} />
        <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>Costo {money(asset.cost)} → utilidad <b style={{ color: profit < 0 ? "var(--expense)" : "var(--income)" }}>{money(profit, "COP", { sign: true })}</b></p>
      </div>
      <div className="field"><label htmlFor="sell-date">Fecha</label><input id="sell-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></div>
      <div className="field">
        <span className="lbl">¿A qué cuenta entró la plata?</span>
        <button type="button" className="picker" onClick={() => setPick(true)}>
          {acc ? <><AccountIcon type={acc.type} size={34} /><span className="v">{acc.name}</span></> : <span className="ph">Elige la cuenta</span>}
          <IChevR size={18} className="chev" />
        </button>
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
          <input type="checkbox" checked={!record} onChange={(e) => setRecord(!e.target.checked)} style={{ marginTop: 3 }} />
          <span>Solo marcarlo como vendido (la plata ya la registré)</span>
        </label>
      </div>
      {record
        ? <button className="btn" disabled={!value || !acc} onClick={() => setStep(2)}>Siguiente: repartir la plata</button>
        : <button className="btn" disabled={!value || busy} onClick={save}>{busy ? "Guardando…" : "Marcar vendido"}</button>}
      <p className="muted xsmall" style={{ marginTop: 10 }}>Negocio: {biz?.name}</p>
      <AccountSheet open={pick} currency="COP" onClose={() => setPick(false)} onPick={(a) => { setAccountId(a.id); setPick(false); }} />
    </div>
  );

  return (
    <div>
      <div className="hero" style={{ padding: 16, marginBottom: 14 }}>
        <div className="label">Entran a {acc?.name}</div>
        <div className="big num" style={{ fontSize: 26 }}>{money(value)}</div>
        <div className="sub">Utilidad {money(profit, "COP", { sign: true })}</div>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>Haz estas transferencias en Bancolombia, desde el disponible a cada bolsillo. Puedes cambiar los valores.</p>
      <div className="list" style={{ marginBottom: 12 }}>
        {lines.map((l) => (
          <div key={l.key} className="row" style={{ alignItems: "center", gap: 10 }}>
            <div className="main">
              <div className="t1" style={{ whiteSpace: "normal" }}>{l.label} → {accById(l.to ?? null)?.name ?? "queda en el disponible"}</div>
              <div className="t2" style={{ whiteSpace: "normal" }}>{l.hint}</div>
            </div>
            {l.key === "profit"
              ? <b className="num" style={{ color: "var(--income)" }}>{money(l.amount)}</b>
              : <input aria-label={l.label} className="input num" style={{ width: 130, height: 40, textAlign: "right" }} inputMode="numeric"
                  value={edits[l.key] ?? amountToInput(l.amount)} onChange={(e) => setEdits({ ...edits, [l.key]: formatTyping(e.target.value) })} />}
          </div>
        ))}
        {pa > 0 && (
          <div className="row"><div className="main"><div className="t1">Parte de {asset.partner_name}</div><div className="t2">Queda en el disponible para pagarle</div></div><b className="num">{money(pa)}</b></div>
        )}
        {bizShare > 0 && (
          <div className="row"><div className="main"><div className="t1">{biz?.partner_share}% de {biz?.partner_name || "tu socio"}</div><div className="t2">Queda en el disponible y anotado en Deudas</div></div><b className="num">{money(bizShare)}</b></div>
        )}
        <div className="row"><div className="main"><div className="t1">Queda en {acc?.name}</div></div><b className="num">{money(keep)}</b></div>
      </div>
      {over && <div className="alert danger" style={{ marginBottom: 12 }}><span>El reparto suma más que la venta. Baja algún valor.</span></div>}
      {pa > 0 && asset.partner_name && (
        <div className="field">
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
            <input type="checkbox" checked={partnerDebt} onChange={(e) => setPartnerDebt(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Anotar que le debo {money(pa)} a {asset.partner_name} (Deudas → Yo debo)</span>
          </label>
        </div>
      )}
      <button className="btn" disabled={busy || over} onClick={save}>{busy ? "Guardando…" : "Confirmar venta y reparto"}</button>
      <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => setStep(1)}>Atrás</button>
    </div>
  );
}
