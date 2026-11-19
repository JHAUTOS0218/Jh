"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, formatTyping, money, parseAmount, todayISO } from "@/lib/format";
import type { Account, Currency, TxKind } from "@/lib/types";
import { Seg, Sheet, toast } from "./ui";
import { BizDot } from "./Business";
import { AccountIcon } from "./AccountIcon";
import { IChevR } from "./Icons";

/** Formulario para registrar o editar un gasto, ingreso o transferencia */
export function TxForm() {
  const d = useData();
  const { txDraft, closeTx } = d;
  const open = txDraft !== undefined;
  return (
    <Sheet open={open} onClose={closeTx} full title={txDraft?.id ? "Editar movimiento" : "Nuevo movimiento"}>
      {open && <FormBody key={txDraft?.id ?? "new"} />}
    </Sheet>
  );
}

function FormBody() {
  const { txDraft, closeTx, accounts, businesses, categories, activeId, accById, bump, settings } = useData();
  const editing = !!txDraft?.id;

  const defaultAcc =
    accById(txDraft?.account_id) ??
    accounts.find((a) => a.business_id === activeId) ??
    accounts[0];

  const [kind, setKind] = useState<TxKind>(txDraft?.kind ?? "expense");
  const [accountId, setAccountId] = useState<string | undefined>(defaultAcc?.id);
  const [toAccountId, setToAccountId] = useState<string | undefined>(txDraft?.to_account_id ?? undefined);
  const acc = accById(accountId);
  const toAcc = accById(toAccountId);
  const cur: Currency = acc?.currency ?? "COP";

  const [amountText, setAmountText] = useState(amountToInput(txDraft?.amount ?? 0, cur));
  const [toAmountText, setToAmountText] = useState(amountToInput(txDraft?.to_amount ?? 0, toAcc?.currency ?? "COP"));
  const [businessId, setBusinessId] = useState<string | undefined>(
    txDraft?.business_id ?? activeId ?? defaultAcc?.business_id ?? businesses[0]?.id
  );
  const [bizTouched, setBizTouched] = useState(editing || !!activeId);
  const [categoryId, setCategoryId] = useState<string | null>(txDraft?.category_id ?? null);
  const [description, setDescription] = useState(txDraft?.description ?? "");
  const [note, setNote] = useState(txDraft?.note ?? "");
  const [date, setDate] = useState(txDraft?.date ?? todayISO());
  const [rateText, setRateText] = useState(amountToInput(txDraft?.fx_rate ?? settings.usd_rate, "COP"));
  const [pick, setPick] = useState<null | "from" | "to">(null);
  const [saving, setSaving] = useState(false);

  // El negocio sigue a la cuenta, salvo que lo hayas cambiado a mano
  useEffect(() => {
    if (!bizTouched && acc) setBusinessId(acc.business_id);
  }, [acc, bizTouched]);

  const cats = useMemo(
    () => categories.filter((c) => c.business_id === businessId && c.kind === (kind === "income" ? "income" : "expense") && (!c.archived || c.id === categoryId)),
    [categories, businessId, kind, categoryId]
  );

  // si cambia el negocio o el tipo y la categoría ya no aplica, se limpia
  useEffect(() => {
    if (categoryId && !cats.find((c) => c.id === categoryId)) setCategoryId(null);
  }, [cats, categoryId]);

  const amount = parseAmount(amountText, cur);
  const crossCurrency = kind === "transfer" && acc && toAcc && acc.currency !== toAcc.currency;
  const toAmount = crossCurrency ? parseAmount(toAmountText, toAcc!.currency) : amount;
  const rate = parseAmount(rateText, "COP");

  const valid =
    amount > 0 && !!acc &&
    (kind === "transfer" ? !!toAcc && toAcc.id !== acc.id && toAmount > 0 : !!businessId) &&
    (cur !== "USD" || kind === "transfer" || rate > 0);

  const save = async () => {
    if (!valid || !acc) return;
    setSaving(true);
    const row = {
      kind,
      date,
      amount,
      account_id: acc.id,
      to_account_id: kind === "transfer" ? toAcc!.id : null,
      to_amount: kind === "transfer" ? toAmount : null,
      business_id: kind === "transfer" ? null : businessId,
      category_id: kind === "transfer" ? null : categoryId,
      description: description.trim() || null,
      note: note.trim() || null,
      fx_rate: cur === "USD" ? (kind === "transfer" && crossCurrency ? Math.round(toAmount / amount) : rate || null) : null,
      status: "confirmed" as const,
    };
    const q = editing
      ? sb().from("transactions").update(row).eq("id", txDraft!.id!)
      : sb().from("transactions").insert(row);
    const { error } = await q;
    setSaving(false);
    if (error) return toast(errorText(error));
    toast(editing ? "Cambios guardados" : kind === "transfer" ? "Transferencia registrada" : kind === "income" ? "Ingreso registrado" : "Gasto registrado");
    closeTx();
    bump();
  };

  const remove = async () => {
    if (!txDraft?.id || !confirm("¿Borrar este movimiento? No se puede deshacer.")) return;
    const { error } = await sb().from("transactions").delete().eq("id", txDraft.id);
    if (error) return toast(errorText(error));
    toast("Movimiento borrado");
    closeTx();
    bump();
  };

  if (!accounts.length) {
    return (
      <div className="empty">
        <b>Primero crea una cuenta</b>
        Para registrar movimientos necesitas al menos una cuenta (banco, bolsillo o efectivo).
        <div style={{ marginTop: 16 }}>
          <Link href="/mas/cuentas?nueva=1" className="btn" onClick={closeTx}>Crear cuenta</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Seg
        value={kind}
        onChange={setKind}
        options={[
          { value: "expense", label: "Gasto", cls: "expense" },
          { value: "income", label: "Ingreso", cls: "income" },
          { value: "transfer", label: "Transferencia" },
        ]}
      />

      <div className="amount-box">
        <input
          className={"amount-input num " + (kind === "transfer" ? "" : kind)}
          inputMode={cur === "USD" ? "decimal" : "numeric"}
          placeholder={cur === "USD" ? "US$0" : "$0"}
          value={amountText ? (cur === "USD" ? "US$" : "$") + amountText : ""}
          onChange={(e) => setAmountText(formatTyping(e.target.value.replace(/^US\$|^\$/, ""), cur))}
          autoFocus={!editing}
        />
        <div className="cur">{cur === "USD" ? "Dólares" : "Pesos colombianos"}</div>
      </div>

      {kind === "transfer" ? (
        <>
          <div className="field">
            <span className="lbl">Desde</span>
            <AccountPicker account={acc} onClick={() => setPick("from")} />
          </div>
          <div className="field">
            <span className="lbl">Hacia</span>
            <AccountPicker account={toAcc} placeholder="Elige la cuenta destino" onClick={() => setPick("to")} />
          </div>
          {crossCurrency && (
            <div className="field">
              <label>¿Cuánto llegó a {toAcc!.name}? ({toAcc!.currency === "USD" ? "dólares" : "pesos"})</label>
              <input className="input num" inputMode="decimal" value={toAmountText} onChange={(e) => setToAmountText(formatTyping(e.target.value, toAcc!.currency))} placeholder="0" />
              {amount > 0 && toAmount > 0 && (
                <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>
                  Tasa: {money(acc!.currency === "USD" ? toAmount / amount : amount / toAmount)} por dólar
                </p>
              )}
            </div>
          )}
          <p className="muted xsmall" style={{ margin: "-4px 2px 14px" }}>
            Las transferencias solo mueven plata entre tus cuentas: no cuentan como gasto ni como ingreso.
          </p>
        </>
      ) : (
        <>
          <div className="field">
            <span className="lbl">{kind === "expense" ? "¿De dónde salió la plata?" : "¿A qué cuenta entró?"}</span>
            <AccountPicker account={acc} onClick={() => setPick("from")} />
          </div>

          <div className="field">
            <span className="lbl">¿De qué negocio es?</span>
            <div className="chips scroll">
              {businesses.map((b) => (
                <button key={b.id} type="button" className={"chip" + (businessId === b.id ? " on" : "")} onClick={() => { setBusinessId(b.id); setBizTouched(true); }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: businessId === b.id ? "#fff" : b.color }} />
                  {b.name}
                </button>
              ))}
            </div>
            {acc && businessId && acc.business_id !== businessId && (
              <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>
                Baja el saldo de <b>{acc.name}</b>, pero cuenta en la utilidad de <b>{businesses.find((b) => b.id === businessId)?.name}</b>.
              </p>
            )}
          </div>

          <div className="field">
            <span className="lbl">Categoría</span>
            <div className="chips">
              {cats.map((c) => (
                <button key={c.id} type="button" className={"chip" + (categoryId === c.id ? " on" : "")} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                  {c.name}
                </button>
              ))}
              {!cats.length && <span className="muted small">Este negocio no tiene categorías de {kind === "income" ? "ingreso" : "gasto"}.</span>}
            </div>
          </div>

          {cur === "USD" && (
            <div className="field">
              <label>Tasa del dólar para este movimiento</label>
              <input className="input num" inputMode="numeric" value={rateText} onChange={(e) => setRateText(formatTyping(e.target.value))} />
              {amount > 0 && rate > 0 && <p className="muted xsmall" style={{ margin: "6px 2px 0" }}>Equivale a {money(Math.round(amount * rate))}</p>}
            </div>
          )}
        </>
      )}

      <div className="field">
        <label htmlFor="tx-desc">Descripción</label>
        <input id="tx-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "transfer" ? "Ej. Retiro de JH Autos a Personal" : kind === "income" ? "Ej. Venta Mazda 3 2019" : "Ej. Gasolina"} />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="tx-date">Fecha</label>
          <input id="tx-date" className="input" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value || todayISO())} />
        </div>
        <div className="field">
          <label htmlFor="tx-note">Nota (opcional)</label>
          <input id="tx-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle" />
        </div>
      </div>

      <button className="btn" disabled={!valid || saving} onClick={save}>
        {saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar"}
      </button>
      {editing && (
        <button className="btn danger" style={{ marginTop: 10 }} onClick={remove}>Borrar movimiento</button>
      )}

      <AccountSheet
        open={pick !== null}
        onClose={() => setPick(null)}
        exclude={pick === "to" ? accountId : undefined}
        onPick={(a) => {
          if (pick === "to") setToAccountId(a.id);
          else {
            if (a.currency !== cur) { setAmountText(""); }
            setAccountId(a.id);
            if (a.id === toAccountId) setToAccountId(undefined);
          }
          setPick(null);
        }}
      />
    </div>
  );
}

function AccountPicker({ account, placeholder = "Elige una cuenta", onClick }: { account?: Account; placeholder?: string; onClick: () => void }) {
  const { bizById, balances } = useData();
  const b = bizById(account?.business_id);
  return (
    <button type="button" className="picker" onClick={onClick}>
      {account ? (
        <>
          <AccountIcon type={account.type} size={34} />
          <span className="v">
            {account.name}
            <span className="muted xsmall" style={{ display: "block", fontWeight: 400 }}>
              {[b?.name, account.bank].filter(Boolean).join(" · ")} · {money(balances[account.id] ?? 0, account.currency)}
            </span>
          </span>
        </>
      ) : (
        <span className="ph">{placeholder}</span>
      )}
      <IChevR size={18} className="chev" />
    </button>
  );
}

export function AccountSheet({ open, onClose, onPick, exclude }: { open: boolean; onClose: () => void; onPick: (a: Account) => void; exclude?: string }) {
  const { businesses, accounts, balances } = useData();
  return (
    <Sheet open={open} onClose={onClose} title="Elige la cuenta">
      {businesses.map((b) => {
        const list = accounts.filter((a) => a.business_id === b.id && a.id !== exclude);
        if (!list.length) return null;
        return (
          <div key={b.id}>
            <div className="day-head" style={{ alignItems: "center", justifyContent: "flex-start", gap: 8 }}>
              <BizDot name={b.name} color={b.color} size={18} /> {b.name}
            </div>
            <div className="list">
              {list.map((a) => (
                <button key={a.id} className="row link" onClick={() => onPick(a)}>
                  <AccountIcon type={a.type} />
                  <div className="main">
                    <div className="t1">{a.name}</div>
                    <div className="t2">{a.bank || "—"}</div>
                  </div>
                  <div className="amt num">{money(balances[a.id] ?? 0, a.currency)}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
