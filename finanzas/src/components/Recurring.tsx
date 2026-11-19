"use client";

import { useMemo, useState } from "react";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, formatTyping, money, parseAmount, shortDate, todayISO } from "@/lib/format";
import type { Account, CatKind, Recurring, Tx } from "@/lib/types";
import { Seg, Sheet, toast } from "./ui";
import { AccountSheet } from "./TxForm";
import { AccountIcon } from "./AccountIcon";
import { BizDot } from "./Business";
import { IChevR } from "./Icons";

// ------------------------------------------------------------------
//  Estado de un pago fijo en el mes actual
// ------------------------------------------------------------------
export type RecState = "paid" | "overdue" | "today" | "soon" | "later";

export function recurringStatus(r: Recurring, paid?: Tx): { state: RecState; days: number; label: string } {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const day = Math.min(r.day_of_month, last);
  const days = day - now.getDate();
  if (paid) return { state: "paid", days, label: `Pagado el ${shortDate(paid.date)}` };
  if (days < 0) return { state: "overdue", days, label: days === -1 ? "Venció ayer" : `Venció hace ${-days} días` };
  if (days === 0) return { state: "today", days, label: "Vence hoy" };
  if (days <= 5) return { state: "soon", days, label: days === 1 ? "Vence mañana" : `Vence en ${days} días` };
  return { state: "later", days, label: `Día ${r.day_of_month}` };
}

const pillStyle: Record<RecState, React.CSSProperties> = {
  paid: { background: "#e3f1ec", color: "#12523d" },
  overdue: { background: "var(--expense-soft)", color: "#7c2a20" },
  today: { background: "var(--expense-soft)", color: "#7c2a20" },
  soon: { background: "var(--warn-soft)", color: "#6d4a0f" },
  later: { background: "var(--surface-2)", color: "var(--ink-2)" },
};

/** Fila de un pago fijo con botón Pagar / Pagado */
export function RecurringRow({ r, onOpen, onPay }: { r: Recurring; onOpen: () => void; onPay: () => void }) {
  const { recurringPaid, bizById, catById, accById } = useData();
  const paid = recurringPaid[r.id];
  const st = recurringStatus(r, paid);
  const b = bizById(r.business_id);
  const acc = accById(paid?.account_id ?? r.account_id);
  return (
    <div className="row" style={{ alignItems: "center" }}>
      <button onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textAlign: "left" }}>
        {b && <BizDot name={b.name} color={b.color} size={36} />}
        <div className="main">
          <div className="t1">{r.name}</div>
          <div className="t2">{[catById(r.category_id)?.name ?? b?.name, acc?.name].filter(Boolean).join(" · ")}</div>
          <span className="tag" style={{ ...pillStyle[st.state], marginTop: 4 }}>{st.label}</span>
        </div>
      </button>
      <div style={{ textAlign: "right", flex: "none" }}>
        <div className={"num " + (r.kind === "income" ? "amt income" : "amt")} style={{ fontWeight: 700 }}>
          {money(paid ? paid.amount : r.amount, acc?.currency ?? "COP")}
        </div>
        {paid ? (
          <button className="link-btn" style={{ fontSize: 12.5, color: "var(--income)" }} onClick={onOpen}>✓ Pagado</button>
        ) : (
          <button className="btn small" style={{ height: 32, padding: "0 12px", marginTop: 4, fontSize: 13 }} onClick={onPay}>
            {r.kind === "income" ? "Recibí" : "Pagar"}
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
//  Marcar pagado → crea el movimiento
// ------------------------------------------------------------------
export function PayRecurring({ r, onDone }: { r: Recurring; onDone: () => void }) {
  const { accounts, accById, bump } = useData();
  const def = accById(r.account_id) ?? accounts.find((a) => a.business_id === r.business_id) ?? accounts[0];
  const [accountId, setAccountId] = useState<string | undefined>(def?.id);
  const acc = accById(accountId);
  const cur = acc?.currency ?? "COP";
  const [amount, setAmount] = useState(amountToInput(r.amount, cur));
  const [date, setDate] = useState(todayISO());
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const value = parseAmount(amount, cur);

  const save = async () => {
    if (!value || !acc) return;
    setBusy(true);
    const { error } = await sb().from("transactions").insert({
      kind: r.kind,
      date,
      amount: value,
      account_id: acc.id,
      business_id: r.business_id,
      category_id: r.category_id,
      description: r.name,
      recurring_id: r.id,
    });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(r.kind === "income" ? "Marcado como recibido" : "Marcado como pagado ✓");
    bump();
    onDone();
  };

  return (
    <div>
      <div className="amount-box">
        <input className={"amount-input num " + (r.kind === "income" ? "income" : "expense")} inputMode={cur === "USD" ? "decimal" : "numeric"} value={amount ? (cur === "USD" ? "US$" : "$") + amount : ""} onChange={(e) => setAmount(formatTyping(e.target.value.replace(/^US\$|^\$/, ""), cur))} />
        <div className="cur">Si este mes el valor cambió (ej. servicios), corrígelo aquí</div>
      </div>
      <div className="field">
        <span className="lbl">{r.kind === "income" ? "¿A qué cuenta entró?" : "¿De qué cuenta salió?"}</span>
        <AccountPick account={acc} onClick={() => setPick(true)} />
      </div>
      <div className="field">
        <label htmlFor="rec-pay-date">Fecha</label>
        <input id="rec-pay-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
      </div>
      <button className="btn" disabled={!value || !acc || busy} onClick={save}>{busy ? "Guardando…" : r.kind === "income" ? "Marcar recibido" : "Marcar pagado"}</button>
      <AccountSheet open={pick} onClose={() => setPick(false)} onPick={(a) => { if (a.currency !== cur) setAmount(""); setAccountId(a.id); setPick(false); }} />
    </div>
  );
}

function AccountPick({ account, onClick, placeholder = "Elige la cuenta" }: { account?: Account; onClick: () => void; placeholder?: string }) {
  const { balances } = useData();
  return (
    <button type="button" className="picker" onClick={onClick}>
      {account ? (
        <>
          <AccountIcon type={account.type} size={34} />
          <span className="v">{account.name}<span className="muted xsmall" style={{ display: "block", fontWeight: 400 }}>{money(balances[account.id] ?? 0, account.currency)}</span></span>
        </>
      ) : <span className="ph">{placeholder}</span>}
      <IChevR size={18} className="chev" />
    </button>
  );
}

// ------------------------------------------------------------------
//  Crear / editar pago fijo
// ------------------------------------------------------------------
export function RecurringForm({ rec, onDone }: { rec: Recurring | null; onDone: () => void }) {
  const { businesses, categories, accById, activeId, allRecurring, recurringPaid, bump, refresh } = useData();
  const [name, setName] = useState(rec?.name ?? "");
  const [kind, setKind] = useState<CatKind>(rec?.kind ?? "expense");
  const [businessId, setBusinessId] = useState(rec?.business_id ?? activeId ?? businesses.find((b) => b.name === "Personal")?.id ?? businesses[0]?.id);
  const [categoryId, setCategoryId] = useState<string | null>(rec?.category_id ?? null);
  const [accountId, setAccountId] = useState<string | undefined>(rec?.account_id ?? undefined);
  const acc = accById(accountId);
  const cur = acc?.currency ?? "COP";
  const [amount, setAmount] = useState(amountToInput(rec?.amount ?? 0, cur));
  const [day, setDay] = useState(String(rec?.day_of_month ?? new Date().getDate()));
  const [note, setNote] = useState(rec?.note ?? "");
  const [active, setActive] = useState(rec?.active ?? true);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);

  const cats = useMemo(() => categories.filter((c) => c.business_id === businessId && c.kind === kind && !c.archived), [categories, businessId, kind]);
  const value = parseAmount(amount, cur);
  const dayN = Math.min(31, Math.max(1, parseInt(day || "1", 10)));
  const valid = name.trim() && value > 0 && businessId;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const row = {
      name: name.trim(), kind, amount: value, business_id: businessId,
      category_id: cats.some((c) => c.id === categoryId) ? categoryId : null,
      account_id: acc?.id ?? null, day_of_month: dayN, note: note.trim() || null, active,
    };
    const { error } = rec
      ? await sb().from("recurring_payments").update(row).eq("id", rec.id)
      : await sb().from("recurring_payments").insert({ ...row, sort: allRecurring.length });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(rec ? "Pago fijo actualizado" : "Pago fijo creado");
    bump();
    onDone();
  };

  const remove = async () => {
    if (!rec || !confirm(`¿Borrar "${rec.name}"? Los pagos que ya hiciste se conservan en Movimientos.`)) return;
    const { error } = await sb().from("recurring_payments").delete().eq("id", rec.id);
    if (error) return toast(errorText(error));
    toast("Pago fijo borrado");
    bump();
    onDone();
  };

  const undoPaid = async () => {
    const t = rec && recurringPaid[rec.id];
    if (!t || !confirm("¿Deshacer el pago de este mes? Se borra el movimiento y el saldo de la cuenta vuelve como estaba.")) return;
    const { error } = await sb().from("transactions").delete().eq("id", t.id);
    if (error) return toast(errorText(error));
    toast("Pago deshecho");
    await refresh();
    onDone();
  };

  const paidTx = rec ? recurringPaid[rec.id] : undefined;

  return (
    <div>
      {paidTx && (
        <div className="alert" style={{ background: "#e3f1ec", color: "#12523d", marginBottom: 14, justifyContent: "space-between", alignItems: "center" }}>
          <span>✓ Este mes ya se pagó: {money(paidTx.amount, accById(paidTx.account_id)?.currency)} el {shortDate(paidTx.date)}.</span>
          <button className="link-btn" style={{ color: "#7c2a20", fontSize: 13, flex: "none" }} onClick={undoPaid}>Deshacer</button>
        </div>
      )}
      <Seg value={kind} onChange={setKind} options={[{ value: "expense", label: "Pago (gasto)", cls: "expense" }, { value: "income", label: "Cobro (ingreso)", cls: "income" }]} />
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="rec-name">Nombre</label>
        <input id="rec-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "income" ? "Ej. Arriendo local que alquilo" : "Ej. Arriendo, Internet, Netflix, Plan de datos"} />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="rec-amount">Valor mensual</label>
          <input id="rec-amount" className="input num" inputMode={cur === "USD" ? "decimal" : "numeric"} value={amount} onChange={(e) => setAmount(formatTyping(e.target.value, cur))} placeholder="0" />
        </div>
        <div className="field">
          <label htmlFor="rec-day">Día del mes</label>
          <input id="rec-day" className="input num" inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </div>
      </div>
      <div className="field">
        <span className="lbl">¿De qué negocio es?</span>
        <div className="chips scroll">
          {businesses.map((b) => (
            <button key={b.id} type="button" className={"chip" + (businessId === b.id ? " on" : "")} onClick={() => setBusinessId(b.id)}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: businessId === b.id ? "#fff" : b.color }} />{b.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="lbl">Categoría</span>
        <div className="chips">
          {cats.map((c) => (
            <button key={c.id} type="button" className={"chip" + (categoryId === c.id ? " on" : "")} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>{c.name}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="lbl">Cuenta con la que normalmente pagas (opcional)</span>
        <AccountPick account={acc} placeholder="Elegir al momento de pagar" onClick={() => setPick(true)} />
      </div>
      <div className="field">
        <label htmlFor="rec-note">Nota</label>
        <input id="rec-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. número de contrato, referencia de pago" />
      </div>
      {rec && (
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo (desmárcalo para pausarlo sin borrarlo)
          </label>
        </div>
      )}
      <button className="btn" disabled={!valid || busy} onClick={save}>{busy ? "Guardando…" : rec ? "Guardar cambios" : "Crear pago fijo"}</button>
      {rec && <button className="btn danger" style={{ marginTop: 10 }} onClick={remove}>Borrar pago fijo</button>}
      <AccountSheet open={pick} onClose={() => setPick(false)} onPick={(a) => { if (a.currency !== cur) setAmount(""); setAccountId(a.id); setPick(false); }} />
    </div>
  );
}

/** Controlador de las hojas (editar / pagar) para usar en cualquier pantalla */
export function useRecurringSheets() {
  const { allRecurring } = useData();
  const [editing, setEditing] = useState<Recurring | "new" | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const paying = allRecurring.find((r) => r.id === payingId) ?? null;
  const sheets = (
    <>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} full title={editing === "new" ? "Nuevo pago fijo" : "Editar pago fijo"}>
        {editing !== null && <RecurringForm key={editing === "new" ? "new" : editing.id} rec={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <Sheet open={!!paying} onClose={() => setPayingId(null)} title={paying?.name ?? ""}>
        {paying && <PayRecurring key={paying.id} r={paying} onDone={() => setPayingId(null)} />}
      </Sheet>
    </>
  );
  return { sheets, edit: (r: Recurring | "new") => setEditing(r), pay: (r: Recurring) => setPayingId(r.id) };
}

