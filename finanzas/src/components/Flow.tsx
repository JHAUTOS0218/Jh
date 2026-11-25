"use client";

import { useState } from "react";
import { useData } from "@/lib/store";
import { money } from "@/lib/format";
import type { Debt, Recurring } from "@/lib/types";
import { debtDueDays } from "./Debts";
import { IChevD, IChevR } from "./Icons";

const DAY = 86400000;
const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

/** Días hasta la próxima vez que toca un pago fijo (considerando si ya se pagó este mes) */
function recurringDays(r: Recurring, paidThisMonth: boolean): number {
  const t = today0();
  const last = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const thisDate = new Date(t.getFullYear(), t.getMonth(), Math.min(r.day_of_month, last(t.getFullYear(), t.getMonth())));
  if (!paidThisMonth) return Math.round((thisDate.getTime() - t.getTime()) / DAY); // puede ser negativo (vencido)
  const nm = new Date(t.getFullYear(), t.getMonth() + 1, 1);
  const nextDate = new Date(nm.getFullYear(), nm.getMonth(), Math.min(r.day_of_month, last(nm.getFullYear(), nm.getMonth())));
  return Math.round((nextDate.getTime() - t.getTime()) / DAY);
}

interface Item { label: string; amount: number; when: string }

/** Lo que te quedaría en 30 días: saldo de hoy − tarjetas − pagos y cuotas + ingresos y cobros que vienen */
export function FlowCard() {
  const { moneyAccounts, balances, toCOP, cards, recurring, recurringPaid, debts, activeId, accById } = useData();
  const [open, setOpen] = useState<string | null>(null);
  const inScope = (bid: string) => !activeId || bid === activeId;

  const cash = moneyAccounts.filter((a) => inScope(a.business_id)).reduce((s, a) => s + toCOP(balances[a.id] ?? 0, a.currency), 0);

  const cardItems: Item[] = cards.filter((c) => inScope(c.card.business_id) && c.totalDebt > 0)
    .map((c) => ({ label: c.card.name, amount: c.totalDebt, when: c.card.pay_day ? `día ${c.card.pay_day}` : "por pagar" }));

  const payItems: Item[] = [];
  const inItems: Item[] = [];
  for (const r of recurring.filter((x) => inScope(x.business_id))) {
    const days = recurringDays(r, !!recurringPaid[r.id]);
    if (days > 30) continue;
    const cur = accById(r.account_id)?.currency ?? "COP";
    const it = { label: r.name, amount: toCOP(r.amount, cur), when: days < 0 ? "vencido" : days === 0 ? "hoy" : `en ${days} días` };
    (r.kind === "income" ? inItems : payItems).push(it);
  }
  const debtItem = (d: Debt): Item | null => {
    if (d.remaining <= 0 || d.excluded) return null;
    const days = debtDueDays(d);
    if (days === null || days > 30) return null;
    const amt = toCOP(Math.min(d.installment ?? d.remaining, d.remaining), d.currency);
    return { label: `${d.person}${d.description ? " · " + d.description : ""}`, amount: amt, when: days < 0 ? "vencido" : days === 0 ? "hoy" : `en ${days} días` };
  };
  for (const d of debts.filter((x) => inScope(x.business_id))) {
    const it = debtItem(d);
    if (!it) continue;
    (d.direction === "owed" ? inItems : payItems).push(it);
  }

  const sum = (l: Item[]) => l.reduce((s, x) => s + x.amount, 0);
  const cardsT = sum(cardItems), payT = sum(payItems), inT = sum(inItems);
  const result = cash - cardsT - payT + inT;

  const Row = ({ id, label, value, items, sign }: { id: string; label: string; value: number; items?: Item[]; sign: "+" | "-" | "" }) => (
    <>
      <button className="rowf" style={{ width: "100%" }} onClick={() => items?.length && setOpen(open === id ? null : id)}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {label}
          {items?.length ? <span className="muted xsmall">({items.length})</span> : null}
          {items?.length ? (open === id ? <IChevD size={14} /> : <IChevR size={14} />) : null}
        </span>
        <b className="num" style={{ color: sign === "-" ? "var(--expense)" : sign === "+" ? "var(--income)" : undefined }}>
          {sign === "-" && value ? "-" : sign === "+" && value ? "+" : ""}{money(value)}
        </b>
      </button>
      {open === id && items?.map((x, i) => (
        <div key={i} className="rowf" style={{ paddingLeft: 28, fontSize: 13 }}>
          <span className="muted" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.label} · {x.when}</span>
          <span className="num">{money(x.amount)}</span>
        </div>
      ))}
    </>
  );

  return (
    <div className="card flow">
      <Row id="cash" label="Plata disponible hoy" value={cash} sign="" />
      <Row id="cards" label="Tarjetas por pagar" value={cardsT} items={cardItems} sign="-" />
      <Row id="pay" label="Pagos fijos y cuotas" value={payT} items={payItems} sign="-" />
      <Row id="in" label="Cobros e ingresos que vienen" value={inT} items={inItems} sign="+" />
      <div className="rowf total">
        <span>Te quedaría en 30 días</span>
        <b className="num" style={{ color: result < 0 ? "var(--expense)" : "var(--accent)" }}>{money(result)}</b>
      </div>
    </div>
  );
}
