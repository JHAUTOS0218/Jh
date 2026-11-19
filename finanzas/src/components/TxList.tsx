"use client";

import { useRouter } from "next/navigation";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { dayLabel, money } from "@/lib/format";
import type { Tx } from "@/lib/types";
import { IArrowDown, IArrowUp, IEdit, ITransfer, ITrash } from "./Icons";
import { SwipeRow, toast } from "./ui";

export function TxRow({ t, showBiz }: { t: Tx; showBiz?: boolean }) {
  const { accById, catById, bizById } = useData();
  const acc = accById(t.account_id);
  const to = accById(t.to_account_id);
  const cat = catById(t.category_id);
  const biz = bizById(t.business_id);
  const cur = acc?.currency ?? "COP";

  const isDebt = t.kind === "debt_in" || t.kind === "debt_out";
  const title =
    isDebt
      ? t.description || (t.kind === "debt_in" ? "Entrada por deuda" : "Salida por deuda")
      : t.kind === "transfer"
      ? t.description || "Transferencia"
      : t.description || cat?.name || (t.kind === "income" ? "Ingreso" : "Gasto");

  const sub =
    isDebt
      ? [t.debt_role === "payment" ? "Abono de deuda" : "Préstamo", acc?.name].filter(Boolean).join(" · ")
      : t.kind === "transfer"
      ? `${acc?.name ?? "?"} → ${to?.name ?? "?"}`
      : [t.description ? cat?.name : null, acc?.name, showBiz && biz && acc?.business_id !== biz.id ? biz.name : null].filter(Boolean).join(" · ");

  const Icon = t.kind === "income" || t.kind === "debt_in" ? IArrowDown : t.kind === "expense" || t.kind === "debt_out" ? IArrowUp : ITransfer;

  return (
    <div className="row">
      <span className={"ico " + t.kind} style={showBiz && biz ? { boxShadow: `inset 0 -3px 0 ${biz.color}` } : undefined}>
        <Icon size={18} />
      </span>
      <div className="main">
        <div className="t1">{title}</div>
        <div className="t2">{sub || " "}</div>
      </div>
      <div className={"amt num " + t.kind}>
        {t.kind === "income" || t.kind === "debt_in" ? "+" : t.kind === "expense" || t.kind === "debt_out" ? "-" : ""}
        {money(t.amount, cur)}
        {isDebt && <span className="s">no es {t.kind === "debt_in" ? "ingreso" : "gasto"}</span>}
        {cur === "USD" && t.kind !== "transfer" && <span className="s">≈ {money(t.amount_cop)}</span>}
        {t.kind === "transfer" && to && to.currency !== cur && <span className="s">llegan {money(t.to_amount, to.currency)}</span>}
      </div>
    </div>
  );
}

/** Lista agrupada por día, con deslizar → Editar / Borrar */
export function TxList({ txs, showBiz, grouped = true }: { txs: Tx[]; showBiz?: boolean; grouped?: boolean }) {
  const { openTx, bump } = useData();
  const router = useRouter();

  const del = async (t: Tx) => {
    if (!confirm("¿Borrar este movimiento? No se puede deshacer.")) return;
    const { error } = await sb().from("transactions").delete().eq("id", t.id);
    if (error) return toast(errorText(error));
    toast("Movimiento borrado");
    bump();
  };

  const row = (t: Tx) => (
    <SwipeRow
      key={t.id}
      onTap={() => (t.debt_id ? router.push(`/deudas?id=${t.debt_id}`) : openTx(t))}
      actions={[
        { label: "Editar", color: "#4e6e66", icon: <IEdit size={18} />, onClick: () => openTx(t) },
        { label: "Borrar", color: "#b2463a", icon: <ITrash size={18} />, onClick: () => del(t) },
      ]}
    >
      <TxRow t={t} showBiz={showBiz} />
    </SwipeRow>
  );

  if (!grouped) return <div className="list">{txs.map(row)}</div>;

  const groups: { day: string; items: Tx[] }[] = [];
  for (const t of txs) {
    const g = groups[groups.length - 1];
    if (g && g.day === t.date) g.items.push(t);
    else groups.push({ day: t.date, items: [t] });
  }
  return (
    <>
      {groups.map((g) => {
        const net = g.items.reduce((s, t) => s + (t.kind === "income" ? t.amount_cop : t.kind === "expense" ? -t.amount_cop : 0), 0);
        return (
          <div key={g.day}>
            <div className="day-head">
              <span>{dayLabel(g.day)}</span>
              {net !== 0 && <span className="num">{money(net, "COP", { sign: true })}</span>}
            </div>
            <div className="list">{g.items.map(row)}</div>
          </div>
        );
      })}
    </>
  );
}
