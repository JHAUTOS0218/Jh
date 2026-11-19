"use client";

import { useState } from "react";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, formatTyping, money, parseAmount } from "@/lib/format";
import type { CardInfo } from "@/lib/types";
import { Sheet, toast } from "./ui";
import { daysUntilDue } from "./Debts";
import { ICard, IPlus } from "./Icons";

/** "vence en 3 días" para el día de pago de la tarjeta */
export function cardDueText(day?: number | null) {
  if (!day) return null;
  const d = daysUntilDue(day);
  if (d === 0) return "pago vence hoy";
  if (d === 1) return "pago vence mañana";
  if (d <= 5) return `pago vence en ${d} días`;
  return `pago el día ${day}`;
}

/** Tarjeta visual con deuda, cupo y disponible */
export function CardTile({ info, onEdit }: { info: CardInfo; onEdit: () => void }) {
  const { openTx } = useData();
  const { card, usd, debtCOP, debtUSD, totalDebt, limit, overlimit, available, rate } = info;
  const used = limit > 0 ? Math.min(100, (totalDebt / limit) * 100) : 0;
  const low = limit > 0 && available < limit * 0.1;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 12 }}>
      <button onClick={onEdit} style={{ display: "block", width: "100%", textAlign: "left", padding: 16, background: "linear-gradient(140deg, var(--petrol), var(--petrol-deep))", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}><ICard size={20} /> {card.name}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{card.bank || ""}</span>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 14 }}>Debes</div>
        <div className="num" style={{ fontFamily: "var(--display)", fontSize: 24, marginTop: 2 }}>{money(totalDebt)}</div>
        {(debtUSD > 0 || usd) && (
          <div className="num" style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>
            {money(debtCOP)} en pesos + {money(debtUSD, "USD")} en dólares (a {money(rate)})
          </div>
        )}
      </button>
      <div style={{ padding: "12px 16px" }}>
        {limit > 0 ? (
          <>
            <div className="progress" style={{ height: 8, marginTop: 0 }}>
              <div style={{ width: `${used}%`, background: low ? "var(--expense)" : undefined }} />
            </div>
            <div className="split" style={{ paddingBottom: 0 }}>
              <span className="muted">Disponible</span>
              <b className="num" style={{ color: available < 0 ? "var(--expense)" : low ? "var(--warn)" : "var(--income)" }}>{money(available)}</b>
            </div>
            <div className="split"><span className="muted">Cupo</span><span className="num">{money(limit)}</span></div>
            {overlimit > 0 && (
              <>
                <div className="split"><span className="muted">Sobrecupo ({card.overlimit_pct}% del cupo)</span><span className="num">{money(overlimit)}</span></div>
                <div className="split"><span className="muted">Disponible usando el sobrecupo</span><span className="num">{money(available + overlimit)}</span></div>
              </>
            )}
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>Toca la tarjeta para agregar el cupo y ver tu disponible.</p>
        )}
        {(card.cut_day || card.pay_day) && (
          <p className="muted xsmall" style={{ margin: "6px 0 0" }}>
            {[card.cut_day ? `Corte el día ${card.cut_day}` : null, cardDueText(card.pay_day)].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="grid2" style={{ marginTop: 12 }}>
          <button className="btn secondary small" onClick={() => openTx({ kind: "expense", account_id: card.id })}>Registrar compra</button>
          <button className="btn small" onClick={() => openTx({ kind: "transfer", to_account_id: card.id, description: `Pago ${card.name}` })}>Pagar tarjeta</button>
        </div>
        {usd && (
          <button className="link-btn" style={{ display: "block", margin: "10px auto 0", fontSize: 13 }} onClick={() => openTx({ kind: "transfer", to_account_id: usd.id, description: `Pago ${card.name} (dólares)` })}>
            Pagar la parte en dólares
          </button>
        )}
      </div>
    </div>
  );
}

/** Crear o editar una tarjeta de crédito */
export function CardForm({ info, onDone }: { info: CardInfo | null; onDone: () => void }) {
  const { businesses, balances, allAccounts, settings, bump } = useData();
  const card = info?.card;
  const usd = info?.usd;
  const [name, setName] = useState(card?.name ?? "");
  const [bank, setBank] = useState(card?.bank ?? "");
  const [businessId, setBusinessId] = useState(card?.business_id ?? businesses.find((b) => b.name === "Personal")?.id ?? businesses[0]?.id);
  const [limit, setLimit] = useState(amountToInput(card?.credit_limit ?? 0));
  const [overPct, setOverPct] = useState(card?.overlimit_pct ? String(card.overlimit_pct) : "");
  const [debtCOP, setDebtCOP] = useState(amountToInput(info?.debtCOP ?? 0));
  const [hasUsd, setHasUsd] = useState(!!usd);
  const [debtUSD, setDebtUSD] = useState(amountToInput(info?.debtUSD ?? 0, "USD"));
  const [rate, setRate] = useState(card?.card_fx_rate ? amountToInput(card.card_fx_rate) : "");
  const [cutDay, setCutDay] = useState(card?.cut_day ? String(card.cut_day) : "");
  const [payDay, setPayDay] = useState(card?.pay_day ? String(card.pay_day) : "");
  const [busy, setBusy] = useState(false);

  const day = (s: string) => (s ? Math.min(31, Math.max(1, parseInt(s, 10))) : null);
  const valid = name.trim() && businessId;

  // vista previa del disponible
  const pLimit = parseAmount(limit);
  const pRate = parseAmount(rate) || settings.usd_rate;
  const pDebt = parseAmount(debtCOP) + (hasUsd ? parseAmount(debtUSD, "USD") * pRate : 0);

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const c = sb();
    const common = { name: name.trim(), bank: bank.trim() || null, business_id: businessId, type: "card" as const };
    // el saldo inicial se ajusta para que la deuda de hoy quede igual a lo que escribiste
    const targetCOP = -parseAmount(debtCOP);
    const mainRow = {
      ...common,
      currency: "COP",
      credit_limit: pLimit || null,
      overlimit_pct: Number(overPct.replace(",", ".")) || 0,
      cut_day: day(cutDay),
      pay_day: day(payDay),
      card_fx_rate: parseAmount(rate) || null,
      initial_balance: card ? card.initial_balance + (targetCOP - (balances[card.id] ?? 0)) : targetCOP,
    };
    let cardId = card?.id;
    if (card) {
      const { error } = await c.from("accounts").update(mainRow).eq("id", card.id);
      if (error) { setBusy(false); return toast(errorText(error)); }
    } else {
      const { data, error } = await c.from("accounts").insert({ ...mainRow, sort: allAccounts.length }).select().single();
      if (error) { setBusy(false); return toast(errorText(error)); }
      cardId = data.id;
    }
    // parte en dólares
    const targetUSD = -parseAmount(debtUSD, "USD");
    if (hasUsd) {
      const usdRow = { ...common, name: `${name.trim()} · dólares`, currency: "USD" };
      if (usd) {
        const { error } = await c.from("accounts").update({ ...usdRow, initial_balance: usd.initial_balance + (targetUSD - (balances[usd.id] ?? 0)) }).eq("id", usd.id);
        if (error) toast(errorText(error));
      } else {
        const { error } = await c.from("accounts").insert({ ...usdRow, parent_id: cardId, initial_balance: targetUSD, sort: allAccounts.length + 1 });
        if (error) toast(errorText(error));
      }
    } else if (usd) {
      const r = await c.from("accounts").delete().eq("id", usd.id);
      if (r.error) await c.from("accounts").update({ archived: true }).eq("id", usd.id);
    }
    setBusy(false);
    toast(card ? "Tarjeta actualizada" : "Tarjeta agregada");
    bump();
    onDone();
  };

  const remove = async () => {
    if (!card || !confirm(`¿Quitar la tarjeta "${card.name}"?`)) return;
    const { error } = await sb().from("accounts").delete().eq("id", card.id);
    if (error) {
      if (confirm("Esta tarjeta tiene movimientos y no se puede borrar. ¿Archivarla? (deja de aparecer y se conserva el historial)")) {
        await sb().from("accounts").update({ archived: true }).eq("id", card.id);
        if (usd) await sb().from("accounts").update({ archived: true }).eq("id", usd.id);
        toast("Tarjeta archivada");
        bump();
        onDone();
      }
      return;
    }
    toast("Tarjeta quitada");
    bump();
    onDone();
  };

  return (
    <div>
      <div className="field">
        <label htmlFor="card-name">Nombre</label>
        <input id="card-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. TC Bancolombia, TC Nubank" />
      </div>
      <div className="field">
        <label htmlFor="card-bank">Banco</label>
        <input id="card-bank" className="input" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Ej. Bancolombia, Nubank" />
      </div>
      <div className="field">
        <span className="lbl">¿De qué negocio es?</span>
        <div className="chips scroll">
          {businesses.map((b) => (
            <button key={b.id} type="button" className={"chip" + (businessId === b.id ? " on" : "")} onClick={() => setBusinessId(b.id)}>{b.name}</button>
          ))}
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="card-limit">Cupo</label>
          <input id="card-limit" className="input num" inputMode="numeric" value={limit} onChange={(e) => setLimit(formatTyping(e.target.value))} placeholder="Ej. 7.200.000" />
        </div>
        <div className="field">
          <label htmlFor="card-over">Sobrecupo (% del cupo)</label>
          <input id="card-over" className="input num" inputMode="decimal" value={overPct} onChange={(e) => setOverPct(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="Ej. 10" />
          {pLimit > 0 && Number(overPct.replace(",", ".")) > 0 && (
            <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>= {money(Math.round((pLimit * Number(overPct.replace(",", "."))) / 100))} de sobrecupo</p>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="card-debt">Deuda de hoy en pesos</label>
        <input id="card-debt" className="input num" inputMode="numeric" value={debtCOP} onChange={(e) => setDebtCOP(formatTyping(e.target.value))} placeholder="0" />
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
          <input type="checkbox" checked={hasUsd} onChange={(e) => setHasUsd(e.target.checked)} /> También tiene deuda en dólares
        </label>
      </div>
      {hasUsd && (
        <div className="grid2">
          <div className="field">
            <label htmlFor="card-usd">Deuda en dólares</label>
            <input id="card-usd" className="input num" inputMode="decimal" value={debtUSD} onChange={(e) => setDebtUSD(formatTyping(e.target.value, "USD"))} placeholder="US$0" />
          </div>
          <div className="field">
            <label htmlFor="card-rate">Tasa de la tarjeta</label>
            <input id="card-rate" className="input num" inputMode="numeric" value={rate} onChange={(e) => setRate(formatTyping(e.target.value))} placeholder={amountToInput(settings.usd_rate)} />
          </div>
        </div>
      )}
      <div className="grid2">
        <div className="field">
          <label htmlFor="card-cut">Día de corte</label>
          <input id="card-cut" className="input num" inputMode="numeric" value={cutDay} onChange={(e) => setCutDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Ej. 15" />
        </div>
        <div className="field">
          <label htmlFor="card-pay">Día límite de pago</label>
          <input id="card-pay" className="input num" inputMode="numeric" value={payDay} onChange={(e) => setPayDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Opcional" />
        </div>
      </div>

      {pLimit > 0 && (
        <div className="card soft" style={{ marginBottom: 14 }}>
          <div className="split" style={{ paddingTop: 0 }}><span className="muted">Deuda total</span><b className="num">{money(Math.round(pDebt))}</b></div>
          <div className="split"><span className="muted">Disponible</span><b className="num" style={{ color: "var(--income)" }}>{money(Math.round(pLimit - pDebt))}</b></div>
        </div>
      )}

      <button className="btn" disabled={!valid || busy} onClick={save}>{busy ? "Guardando…" : card ? "Guardar cambios" : "Agregar tarjeta"}</button>
      {card && <button className="btn danger" style={{ marginTop: 10 }} onClick={remove}>Quitar tarjeta</button>}
      <p className="muted xsmall" style={{ marginTop: 12 }}>
        Las compras con la tarjeta son gastos (suben la deuda). Pagar la tarjeta es una transferencia desde tu cuenta (baja la deuda y no es un gasto nuevo).
      </p>
    </div>
  );
}

/** Lista de tarjetas + hojas para crear/editar */
export function CardsSection() {
  const { cards, activeId } = useData();
  const [editing, setEditing] = useState<CardInfo | "new" | null>(null);
  const list = cards.filter((c) => !activeId || c.card.business_id === activeId);
  return (
    <>
      <h3 className="h-section">Tarjetas de crédito <button onClick={() => setEditing("new")}><IPlus size={14} style={{ verticalAlign: -2 }} /> Agregar</button></h3>
      {list.length ? (
        list.map((c) => <CardTile key={c.card.id} info={c} onEdit={() => setEditing(c)} />)
      ) : (
        <button className="card soft" style={{ width: "100%", textAlign: "center", color: "var(--muted)" }} onClick={() => setEditing("new")}>
          <ICard size={22} /><br />Agrega tus tarjetas de crédito para ver deuda, cupo y disponible
        </button>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} full title={editing === "new" ? "Nueva tarjeta" : "Editar tarjeta"}>
        {editing !== null && <CardForm key={editing === "new" ? "new" : editing.card.id} info={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}
