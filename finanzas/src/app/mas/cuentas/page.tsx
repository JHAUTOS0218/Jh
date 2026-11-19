"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, formatTyping, money, parseAmount } from "@/lib/format";
import { ACCOUNT_TYPES, accountTypeLabel, type Account, type AccountType, type Currency } from "@/lib/types";
import { BackBar } from "@/components/BackBar";
import { BizDot } from "@/components/Business";
import { AccountIcon } from "@/components/AccountIcon";
import { Seg, Sheet, toast } from "@/components/ui";
import { IPlus, IChevR } from "@/components/Icons";

export default function Page() {
  return <Suspense><Accounts /></Suspense>;
}

function Accounts() {
  const { businesses, allAccounts, balances, toCOP } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (params.get("nueva")) { setEditing("new"); router.replace("/mas/cuentas"); }
  }, [params, router]);

  const visible = allAccounts.filter((a) => a.type !== "card" && (showArchived || !a.archived));
  const archivedCount = allAccounts.filter((a) => a.archived && a.type !== "card").length;

  return (
    <main className="page">
      <BackBar title="Cuentas" right={<button className="btn small" onClick={() => setEditing("new")}><IPlus size={18} /> Nueva</button>} />
      <p className="muted small" style={{ margin: "-6px 2px 8px" }}>
        Dónde está tu plata: cuentas, bolsillos, efectivo y dólares. Las tarjetas de crédito están en <Link href="/deudas" className="link-btn">Deudas</Link>.
      </p>

      {!allAccounts.length && (
        <div className="empty">
          <b>Aún no tienes cuentas</b>
          Crea una por cada lugar donde tengas plata. Ej.: “Bolsillo JH Autos” (Bancolombia 1), “Efectivo”, “Dólares”.
          <div style={{ marginTop: 16 }}><button className="btn" onClick={() => setEditing("new")}><IPlus size={18} /> Crear cuenta</button></div>
        </div>
      )}

      {businesses.map((b) => {
        const list = visible.filter((a) => a.business_id === b.id);
        if (!list.length) return null;
        const total = list.filter((a) => !a.archived).reduce((s, a) => s + toCOP(balances[a.id] ?? 0, a.currency), 0);
        return (
          <div key={b.id}>
            <h3 className="h-section">
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><BizDot name={b.name} color={b.color} size={18} />{b.name}</span>
              <span className="num" style={{ fontFamily: "var(--body)", letterSpacing: 0, fontSize: 13, color: "var(--ink)", fontWeight: 700 }}>{money(total)}</span>
            </h3>
            <div className="list">
              {list.map((a) => (
                <button key={a.id} className={"row link" + (a.archived ? " disabled" : "")} onClick={() => setEditing(a)}>
                  <AccountIcon type={a.type} />
                  <div className="main">
                    <div className="t1">{a.name} {a.currency === "USD" && <span className="tag usd">USD</span>}</div>
                    <div className="t2">{[accountTypeLabel(a.type), a.bank, a.archived ? "archivada" : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className={"amt num" + ((balances[a.id] ?? 0) < 0 ? " expense" : "")}>
                    {money(balances[a.id] ?? 0, a.currency)}
                    {a.min_balance != null && <span className="s">mín. {money(a.min_balance, a.currency)}</span>}
                  </div>
                  <IChevR size={16} className="chev" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {archivedCount > 0 && (
        <button className="link-btn" style={{ display: "block", margin: "18px auto 0" }} onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Ocultar archivadas" : `Ver archivadas (${archivedCount})`}
        </button>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nueva cuenta" : "Editar cuenta"}>
        {editing !== null && <AccountForm key={editing === "new" ? "new" : editing.id} account={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </main>
  );
}

function AccountForm({ account, onDone }: { account: Account | null; onDone: () => void }) {
  const { businesses, allAccounts, balances, activeId, bump } = useData();
  const isNew = !account;
  const current = account ? balances[account.id] ?? 0 : 0;

  const [name, setName] = useState(account?.name ?? "");
  const [businessId, setBusinessId] = useState(account?.business_id ?? activeId ?? businesses[0]?.id);
  const [type, setType] = useState<AccountType>(account?.type ?? "bank");
  const [bank, setBank] = useState(account?.bank ?? "");
  const [currency, setCurrency] = useState<Currency>(account?.currency ?? "COP");
  const isCard = type === "card";
  // Para tarjetas se escribe la deuda en positivo y se guarda en negativo
  const [balText, setBalText] = useState(amountToInput(Math.abs(current), account?.currency ?? "COP"));
  const [negative, setNegative] = useState(current < 0);
  const [minText, setMinText] = useState(account?.min_balance != null ? amountToInput(account.min_balance, account.currency) : "");
  const [busy, setBusy] = useState(false);

  const banks = [...new Set(allAccounts.map((a) => a.bank).filter(Boolean))] as string[];
  const suggestions = [...new Set([...banks, "Bancolombia 1", "Bancolombia 2", "Nequi", "Davivienda"])];

  const save = async () => {
    if (!name.trim() || !businessId) return;
    setBusy(true);
    let target = parseAmount(balText, currency);
    if (isCard || negative) target = -target;
    // saldo_inicial se calcula para que el saldo de hoy quede igual a lo que escribiste
    const initial = account ? account.initial_balance + (target - current) : target;
    const row = {
      name: name.trim(),
      business_id: businessId,
      type,
      bank: bank.trim() || null,
      currency,
      initial_balance: Math.round(initial * 100) / 100,
      min_balance: minText ? parseAmount(minText, currency) : null,
    };
    const { error } = account
      ? await sb().from("accounts").update(row).eq("id", account.id)
      : await sb().from("accounts").insert({ ...row, sort: allAccounts.length });
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(isNew ? "Cuenta creada" : "Cuenta actualizada");
    bump();
    onDone();
  };

  const archive = async (v: boolean) => {
    if (!account) return;
    const { error } = await sb().from("accounts").update({ archived: v }).eq("id", account.id);
    if (error) return toast(errorText(error));
    toast(v ? "Cuenta archivada" : "Cuenta activada");
    bump();
    onDone();
  };

  const remove = async () => {
    if (!account || !confirm(`¿Borrar la cuenta "${account.name}"?`)) return;
    const { error } = await sb().from("accounts").delete().eq("id", account.id);
    if (error) {
      if (/foreign key|violates/i.test(error.message)) {
        if (confirm("Esta cuenta tiene movimientos y no se puede borrar. ¿Quieres archivarla? (Deja de aparecer pero se conserva el historial)")) archive(true);
        return;
      }
      return toast(errorText(error));
    }
    toast("Cuenta borrada");
    bump();
    onDone();
  };

  return (
    <div>
      <div className="field">
        <label>Nombre</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Bolsillo JH Autos" autoFocus={isNew} />
      </div>
      <div className="field">
        <span className="lbl">¿De qué negocio es?</span>
        <div className="chips">
          {businesses.map((b) => (
            <button key={b.id} type="button" className={"chip" + (businessId === b.id ? " on" : "")} onClick={() => setBusinessId(b.id)}>{b.name}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="lbl">Tipo</span>
        <div className="chips">
          {ACCOUNT_TYPES.filter((t) => t.value !== "card" || type === "card").map((t) => (
            <button key={t.value} type="button" className={"chip" + (type === t.value ? " on" : "")} onClick={() => setType(t.value)}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Banco al que pertenece</label>
        <input className="input" list="bank-list" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Ej. Bancolombia 2 (vacío si es efectivo)" />
        <datalist id="bank-list">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      <div className="field">
        <span className="lbl">Moneda</span>
        <Seg value={currency} onChange={(c) => { setCurrency(c); setBalText(""); setMinText(""); }} options={[{ value: "COP", label: "Pesos (COP)" }, { value: "USD", label: "Dólares (USD)" }]} />
      </div>
      <div className="field">
        <label>{isCard ? "Deuda actual de la tarjeta" : isNew ? "Saldo de hoy" : "Saldo actual (si no cuadra, escribe el real)"}</label>
        <input className="input num" inputMode={currency === "USD" ? "decimal" : "numeric"} value={balText} onChange={(e) => setBalText(formatTyping(e.target.value, currency))} placeholder="0" />
        {!isCard && (
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 8, color: "var(--muted)" }}>
            <input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} /> El saldo está en negativo (sobregiro)
          </label>
        )}
      </div>
      <div className="field">
        <label>Saldo mínimo (opcional): te aviso si baja de aquí</label>
        <input className="input num" inputMode={currency === "USD" ? "decimal" : "numeric"} value={minText} onChange={(e) => setMinText(formatTyping(e.target.value, currency))} placeholder="Sin mínimo" />
      </div>

      <button className="btn" disabled={busy || !name.trim()} onClick={save}>{busy ? "Guardando…" : isNew ? "Crear cuenta" : "Guardar cambios"}</button>
      {account && (
        <div className="grid2" style={{ marginTop: 10 }}>
          <button className="btn secondary" onClick={() => archive(!account.archived)}>{account.archived ? "Reactivar" : "Archivar"}</button>
          <button className="btn danger" onClick={remove}>Borrar</button>
        </div>
      )}
    </div>
  );
}
