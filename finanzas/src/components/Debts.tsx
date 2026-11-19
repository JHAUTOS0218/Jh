"use client";

import { useEffect, useState } from "react";
import { useData, normalizeTx } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, formatTyping, money, parseAmount, shortDate, todayISO } from "@/lib/format";
import type { Account, Currency, Debt, DebtDirection, Tx } from "@/lib/types";
import { Seg, Sheet, SwipeRow, toast } from "./ui";
import { AccountSheet } from "./TxForm";
import { AccountIcon } from "./AccountIcon";
import { IChevR, IClose, IEdit, IPlus, ITrash } from "./Icons";

/** "vence el 15" / "vence hoy" / "vence en 3 días" */
export function nextDueText(d: Debt) {
  if (!d.due_day) return null;
  const days = daysUntilDue(d.due_day);
  if (days === 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  if (days <= 5) return `vence en ${days} días`;
  return `día ${d.due_day} de cada mes`;
}

export function daysUntilDue(dueDay: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastThis = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let due = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, lastThis));
  if (due < today) {
    const lastNext = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
    due = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dueDay, lastNext));
  }
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// ------------------------------------------------------------------
//  Crear / editar deuda (con opción de dividir entre negocios)
// ------------------------------------------------------------------
interface Part { businessId: string; amount: string }

export function DebtForm({ debt, defaultDirection, onDone }: { debt: Debt | null; defaultDirection: DebtDirection; onDone: () => void }) {
  const { businesses, accounts, allDebts, settings, activeId, bump, accById } = useData();
  const isNew = !debt;
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? defaultDirection);
  const [person, setPerson] = useState(debt?.person ?? "");
  const [description, setDescription] = useState(debt?.description ?? "");
  const [category, setCategory] = useState<string | null>(debt?.category ?? null);
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? "COP");
  const [split, setSplit] = useState(false);
  const firstBiz = debt?.business_id ?? activeId ?? businesses[0]?.id ?? "";
  const [parts, setParts] = useState<Part[]>([{ businessId: firstBiz, amount: amountToInput(debt?.total_amount ?? 0, debt?.currency ?? "COP") }]);
  const [installment, setInstallment] = useState(amountToInput(debt?.installment ?? 0, debt?.currency ?? "COP"));
  const [dueDay, setDueDay] = useState(debt?.due_day ? String(debt.due_day) : "");
  const [startDate, setStartDate] = useState(debt?.start_date ?? todayISO());
  const [note, setNote] = useState(debt?.note ?? "");
  const [moveMoney, setMoveMoney] = useState(false);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [pickAcc, setPickAcc] = useState(false);
  const [busy, setBusy] = useState(false);

  const account = accById(accountId);
  const people = [...new Set(allDebts.map((d) => d.person))];
  const amounts = parts.map((p) => parseAmount(p.amount, currency));
  const total = amounts.reduce((s, x) => s + x, 0);
  const valid = person.trim() && total > 0 && parts.every((p, i) => p.businessId && amounts[i] > 0) && (!moveMoney || !!account);

  const setPart = (i: number, patch: Partial<Part>) => setParts(parts.map((p, j) => (i === j ? { ...p, ...patch } : p)));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const common = {
      direction,
      person: person.trim(),
      description: description.trim() || null,
      category,
      currency,
      installment: parseAmount(installment, currency) || null,
      due_day: dueDay ? Math.min(31, Math.max(1, parseInt(dueDay, 10))) : null,
      start_date: startDate,
      note: note.trim() || null,
    };
    if (debt) {
      if (total < debt.paid && !confirm(`Ya se han pagado ${money(debt.paid, debt.currency)}, más que el nuevo total. ¿Guardar igual?`)) { setBusy(false); return; }
      const { error } = await sb().from("debts").update({ ...common, business_id: parts[0].businessId, total_amount: total }).eq("id", debt.id);
      setBusy(false);
      if (error) return toast(errorText(error));
      toast("Deuda actualizada");
    } else {
      const rows = parts.map((p, i) => ({ ...common, business_id: p.businessId, total_amount: amounts[i] }));
      const { data, error } = await sb().from("debts").insert(rows).select();
      if (error) { setBusy(false); return toast(errorText(error)); }
      if (moveMoney && account) {
        const txs = (data as Debt[]).map((d) => ({
          kind: direction === "owed" ? "debt_out" : "debt_in",
          date: startDate,
          amount: Number(d.total_amount),
          account_id: account.id,
          business_id: d.business_id,
          debt_id: d.id,
          debt_role: "disbursement",
          description: direction === "owed" ? `Préstamo a ${d.person}` : `Préstamo de ${d.person}`,
        }));
        const r = await sb().from("transactions").insert(txs);
        if (r.error) toast(errorText(r.error));
      }
      setBusy(false);
      toast(rows.length > 1 ? `Deuda registrada en ${rows.length} negocios` : "Deuda registrada");
    }
    bump();
    onDone();
  };

  return (
    <div>
      <Seg value={direction} onChange={setDirection} options={[{ value: "owed", label: "Me deben", cls: "income" }, { value: "owe", label: "Yo debo", cls: "expense" }]} />
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="debt-person">{direction === "owed" ? "¿Quién te debe?" : "¿A quién le debes?"}</label>
        <input id="debt-person" className="input" list="people-list" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Ej. Carlos Pérez, Bancolombia, proveedor…" />
        <datalist id="people-list">{people.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <div className="field">
        <label htmlFor="debt-desc">Concepto</label>
        <input id="debt-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Saldo venta Mazda 3, préstamo personal…" />
      </div>
      <div className="field">
        <span className="lbl">Categoría</span>
        <div className="chips">
          {settings.debt_categories.map((c) => (
            <button key={c} type="button" className={"chip" + (category === c ? " on" : "")} onClick={() => setCategory(category === c ? null : c)}>{c}</button>
          ))}
          <AddDebtCategoryChip onAdded={setCategory} />
        </div>
      </div>
      <div className="field">
        <span className="lbl">Moneda</span>
        <Seg value={currency} onChange={(c) => { setCurrency(c); setParts(parts.map((p) => ({ ...p, amount: "" }))); setInstallment(""); setAccountId(undefined); }} options={[{ value: "COP", label: "Pesos" }, { value: "USD", label: "Dólares" }]} />
      </div>

      {/* Monto y negocio(s) */}
      {parts.map((p, i) => (
        <div key={i} className="card soft" style={{ marginBottom: 10, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="lbl" style={{ margin: 0 }}>{split ? `Parte ${i + 1}` : "Monto total"}</span>
            {split && parts.length > 1 && <button onClick={() => setParts(parts.filter((_, j) => j !== i))} aria-label="Quitar parte" style={{ color: "var(--muted)" }}><IClose size={18} /></button>}
          </div>
          <input className="input num" style={{ marginTop: 6, background: "#fff", fontSize: 20, fontWeight: 700 }} inputMode={currency === "USD" ? "decimal" : "numeric"} value={p.amount} onChange={(e) => setPart(i, { amount: formatTyping(e.target.value, currency) })} placeholder={currency === "USD" ? "US$0" : "$0"} />
          <div className="chips scroll" style={{ marginTop: 8 }}>
            {businesses.map((b) => (
              <button key={b.id} type="button" className={"chip" + (p.businessId === b.id ? " on" : " outline")} onClick={() => setPart(i, { businessId: b.id })}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: p.businessId === b.id ? "#fff" : b.color }} />{b.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {isNew && (
        split ? (
          <>
            <button className="btn secondary small" style={{ width: "100%" }} onClick={() => setParts([...parts, { businessId: businesses.find((b) => !parts.some((p) => p.businessId === b.id))?.id ?? businesses[0].id, amount: "" }])}>
              <IPlus size={16} /> Agregar otra parte
            </button>
            <div className="split" style={{ marginBottom: 6 }}><b>Total</b><b className="num">{money(total, currency)}</b></div>
          </>
        ) : (
          <button className="link-btn" style={{ marginBottom: 14 }} onClick={() => { setSplit(true); setParts([...parts, { businessId: businesses.find((b) => b.id !== parts[0].businessId)?.id ?? businesses[0].id, amount: "" }]); }}>
            ＋ Dividir entre varios negocios
          </button>
        )
      )}

      <div className="grid2" style={{ marginTop: 6 }}>
        <div className="field">
          <label htmlFor="debt-inst">Cuota (opcional)</label>
          <input id="debt-inst" className="input num" inputMode="numeric" value={installment} onChange={(e) => setInstallment(formatTyping(e.target.value, currency))} placeholder="Sin cuota fija" />
        </div>
        <div className="field">
          <label htmlFor="debt-day">Día de pago (1–31)</label>
          <input id="debt-day" className="input num" inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Opcional" />
        </div>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="debt-date">Fecha</label>
          <input id="debt-date" className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || todayISO())} />
        </div>
        <div className="field">
          <label htmlFor="debt-note">Nota</label>
          <input id="debt-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      {isNew && (
        <div className="field">
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink)", fontWeight: 400 }}>
            <input type="checkbox" checked={moveMoney} onChange={(e) => setMoveMoney(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              {direction === "owed" ? "Le presté esta plata desde una de mis cuentas" : "Me prestaron esta plata y entró a una de mis cuentas"}
              <span className="muted xsmall" style={{ display: "block" }}>
                Mueve el saldo de la cuenta, pero no cuenta como {direction === "owed" ? "gasto" : "ingreso"}. Déjalo sin marcar si es una venta a crédito o una deuda que no movió plata.
              </span>
            </span>
          </label>
          {moveMoney && <AccountButton account={account} onClick={() => setPickAcc(true)} />}
        </div>
      )}

      <button className="btn" disabled={!valid || busy} onClick={save}>{busy ? "Guardando…" : isNew ? "Guardar deuda" : "Guardar cambios"}</button>
      <AccountSheet open={pickAcc} currency={currency} onClose={() => setPickAcc(false)} onPick={(a) => { setAccountId(a.id); setPickAcc(false); }} />
      {!accounts.some((a) => a.currency === currency) && moveMoney && <p className="muted small">No tienes cuentas en {currency === "USD" ? "dólares" : "pesos"}.</p>}
    </div>
  );
}

function AccountButton({ account, onClick }: { account?: Account; onClick: () => void }) {
  const { balances } = useData();
  return (
    <button type="button" className="picker" style={{ marginTop: 10 }} onClick={onClick}>
      {account ? (
        <>
          <AccountIcon type={account.type} size={34} />
          <span className="v">{account.name}<span className="muted xsmall" style={{ display: "block", fontWeight: 400 }}>{money(balances[account.id] ?? 0, account.currency)}</span></span>
        </>
      ) : <span className="ph">Elige la cuenta</span>}
      <IChevR size={18} className="chev" />
    </button>
  );
}

function AddDebtCategoryChip({ onAdded }: { onAdded: (c: string) => void }) {
  const { settings, session, bump } = useData();
  const add = async () => {
    const n = prompt("Nombre de la nueva categoría");
    if (!n?.trim()) return;
    const list = [...settings.debt_categories, n.trim()];
    const { error } = await sb().from("settings").upsert({ user_id: session!.user.id, debt_categories: list });
    if (error) return toast(errorText(error));
    onAdded(n.trim());
    bump();
  };
  return <button type="button" className="chip outline" onClick={add}><IPlus size={14} /> Nueva</button>;
}

// ------------------------------------------------------------------
//  Detalle de una deuda + historial de pagos + registrar pago
// ------------------------------------------------------------------
export function DebtDetail({ debt, onEdit, onClose }: { debt: Debt; onEdit: () => void; onClose: () => void }) {
  const { bizById, accById, accounts, bump, version } = useData();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const b = bizById(debt.business_id);
  const pct = debt.total_amount ? Math.min(100, (debt.paid / debt.total_amount) * 100) : 0;
  const owed = debt.direction === "owed";

  useEffect(() => {
    sb().from("transactions").select("*").eq("debt_id", debt.id).order("date", { ascending: false }).order("created_at", { ascending: false })
      .then(({ data }) => setTxs(((data as Tx[]) ?? []).map(normalizeTx)));
  }, [debt.id, version]);

  const delTx = async (t: Tx) => {
    if (!confirm("¿Borrar este registro? El saldo de la cuenta se ajusta.")) return;
    const { error } = await sb().from("transactions").delete().eq("id", t.id);
    if (error) return toast(errorText(error));
    toast("Registro borrado");
    bump();
  };

  const archive = async () => {
    const msg = debt.remaining > 0
      ? `Aún falta ${money(debt.remaining, debt.currency)}. ¿Archivarla igual? (por ejemplo si se perdonó o se pagó de otra forma)`
      : "¿Archivar esta deuda saldada? Dejará de aparecer, pero su historial se conserva.";
    if (!confirm(msg)) return;
    const { error } = await sb().from("debts").update({ archived: true }).eq("id", debt.id);
    if (error) return toast(errorText(error));
    toast("Deuda archivada");
    bump();
    onClose();
  };

  const remove = async () => {
    if (!confirm("¿Borrar esta deuda? Los movimientos de plata que ya registraste se conservan en Movimientos.")) return;
    const { error } = await sb().from("debts").delete().eq("id", debt.id);
    if (error) return toast(errorText(error));
    toast("Deuda borrada");
    bump();
    onClose();
  };

  return (
    <div>
      <div className="card soft" style={{ textAlign: "center", padding: 18 }}>
        <div className="muted small">{owed ? "Te debe todavía" : "Le debes todavía"}</div>
        <div className="num" style={{ fontFamily: "var(--display)", fontSize: 28, margin: "6px 0", color: owed ? "var(--income)" : "var(--expense)" }}>{money(debt.remaining, debt.currency)}</div>
        <div className="progress" style={{ height: 8 }}><div style={{ width: `${pct}%` }} /></div>
        <div className="small muted" style={{ marginTop: 8 }}>Pagado {money(debt.paid, debt.currency)} de {money(debt.total_amount, debt.currency)} ({Math.round(pct)}%)</div>
      </div>

      {debt.remaining > 0 && (
        <button className="btn" style={{ marginTop: 14 }} onClick={() => setPayOpen(true)} disabled={!accounts.some((a) => a.currency === debt.currency)}>
          {owed ? "Registrar abono que me hicieron" : "Registrar pago que hice"}
        </button>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        {[
          ["Concepto", debt.description],
          ["Negocio", b?.name],
          ["Categoría", debt.category],
          ["Cuota", debt.installment ? money(debt.installment, debt.currency) : null],
          ["Día de pago", debt.due_day ? `${debt.due_day} de cada mes${nextDueText(debt) ? ` (${nextDueText(debt)})` : ""}` : null],
          ["Desde", shortDate(debt.start_date)],
          ["Nota", debt.note],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="split"><span className="muted">{k}</span><span style={{ textAlign: "right", fontWeight: 600 }}>{v}</span></div>
        ))}
      </div>

      <h3 className="h-section">Historial</h3>
      {txs.length ? (
        <div className="list">
          {txs.map((t) => (
            <SwipeRow key={t.id} actions={[{ label: "Borrar", color: "#b2463a", icon: <ITrash size={18} />, onClick: () => delTx(t) }]}>
              <div className="row">
                <div className="main">
                  <div className="t1">{t.debt_role === "payment" ? (owed ? "Abono recibido" : "Pago realizado") : owed ? "Préstamo entregado" : "Préstamo recibido"}</div>
                  <div className="t2">{shortDate(t.date)} · {accById(t.account_id)?.name}{t.note ? ` · ${t.note}` : ""}</div>
                </div>
                <div className={"amt num " + (t.kind === "debt_in" ? "income" : "")}>{t.kind === "debt_in" ? "+" : "-"}{money(t.amount, accById(t.account_id)?.currency)}</div>
              </div>
            </SwipeRow>
          ))}
        </div>
      ) : (
        <p className="muted small" style={{ margin: "0 2px" }}>Aún no hay pagos registrados.</p>
      )}

      <div className="grid3" style={{ marginTop: 22 }}>
        <button className="btn secondary small" onClick={onEdit}><IEdit size={16} /> Editar</button>
        <button className="btn secondary small" onClick={archive}>Archivar</button>
        <button className="btn danger small" onClick={remove}><ITrash size={16} /> Borrar</button>
      </div>

      <Sheet open={payOpen} onClose={() => setPayOpen(false)} title={owed ? "Abono recibido" : "Pago realizado"}>
        {payOpen && <PayForm debt={debt} onDone={() => setPayOpen(false)} />}
      </Sheet>
    </div>
  );
}

function PayForm({ debt, onDone }: { debt: Debt; onDone: () => void }) {
  const { accounts, accById, bump } = useData();
  const owed = debt.direction === "owed";
  const suggested = debt.installment ? Math.min(debt.installment, debt.remaining) : debt.remaining;
  const [amount, setAmount] = useState(amountToInput(suggested, debt.currency));
  const def = accounts.find((a) => a.business_id === debt.business_id && a.currency === debt.currency) ?? accounts.find((a) => a.currency === debt.currency);
  const [accountId, setAccountId] = useState<string | undefined>(def?.id);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const value = parseAmount(amount, debt.currency);
  const account = accById(accountId);

  const save = async () => {
    if (!value || !account) return;
    if (value > debt.remaining + 0.001 && !confirm(`El valor es mayor a lo que falta (${money(debt.remaining, debt.currency)}). ¿Guardar igual?`)) return;
    setBusy(true);
    const { error } = await sb().from("transactions").insert({
      kind: owed ? "debt_in" : "debt_out",
      date,
      amount: value,
      account_id: account.id,
      business_id: debt.business_id,
      debt_id: debt.id,
      debt_role: "payment",
      description: owed ? `Abono de ${debt.person}` : `Pago a ${debt.person}`,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(value >= debt.remaining ? "¡Deuda saldada! 🎉" : owed ? "Abono registrado" : "Pago registrado");
    bump();
    onDone();
  };

  return (
    <div>
      <div className="amount-box">
        <input className={"amount-input num " + (owed ? "income" : "expense")} inputMode={debt.currency === "USD" ? "decimal" : "numeric"} value={amount ? (debt.currency === "USD" ? "US$" : "$") + amount : ""} onChange={(e) => setAmount(formatTyping(e.target.value.replace(/^US\$|^\$/, ""), debt.currency))} placeholder="$0" />
        <div className="cur">Falta {money(debt.remaining, debt.currency)}</div>
      </div>
      <div className="field">
        <span className="lbl">{owed ? "¿A qué cuenta entró?" : "¿De qué cuenta salió?"}</span>
        <AccountButton account={account} onClick={() => setPick(true)} />
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="pay-date">Fecha</label><input id="pay-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} /></div>
        <div className="field"><label htmlFor="pay-note">Nota</label><input id="pay-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></div>
      </div>
      <p className="muted xsmall" style={{ margin: "0 2px 12px" }}>
        {owed ? "Entra a la cuenta, pero no cuenta como ingreso (ya era tuyo)." : "Sale de la cuenta, pero no cuenta como gasto (estás pagando una deuda)."}
      </p>
      <button className="btn" disabled={!value || !account || busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>
      <AccountSheet open={pick} currency={debt.currency} onClose={() => setPick(false)} onPick={(a) => { setAccountId(a.id); setPick(false); }} />
    </div>
  );
}

// ------------------------------------------------------------------
//  Editor de categorías de deudas
// ------------------------------------------------------------------
export function DebtCategoriesEditor() {
  const { settings, session, bump } = useData();
  const [newName, setNewName] = useState("");
  const saveList = async (list: string[], msg: string) => {
    const { error } = await sb().from("settings").upsert({ user_id: session!.user.id, debt_categories: list });
    if (error) return toast(errorText(error));
    toast(msg);
    bump();
  };
  const rename = async (i: number) => {
    const old = settings.debt_categories[i];
    const n = prompt("Nuevo nombre", old);
    if (!n?.trim() || n === old) return;
    await saveList(settings.debt_categories.map((c, j) => (j === i ? n.trim() : c)), "Categoría renombrada");
    await sb().from("debts").update({ category: n.trim() }).eq("category", old);
    bump();
  };
  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>Sirven para agrupar lo que te deben y lo que debes. Al renombrar, las deudas existentes se actualizan.</p>
      <div className="list">
        {settings.debt_categories.map((c, i) => (
          <div key={c + i} className="row" style={{ minHeight: 52 }}>
            <div className="main"><div className="t1" style={{ fontWeight: 500 }}>{c}</div></div>
            <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => rename(i)} aria-label="Renombrar"><IEdit size={16} /></button>
            <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => confirm(`¿Quitar "${c}" de la lista?`) && saveList(settings.debt_categories.filter((_, j) => j !== i), "Categoría quitada")} aria-label="Quitar"><ITrash size={16} /></button>
          </div>
        ))}
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ height: 42 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva categoría" />
          <button className="btn small" disabled={!newName.trim()} onClick={async () => { await saveList([...settings.debt_categories, newName.trim()], "Categoría agregada"); setNewName(""); }}><IPlus size={18} /></button>
        </div>
      </div>
    </div>
  );
}
