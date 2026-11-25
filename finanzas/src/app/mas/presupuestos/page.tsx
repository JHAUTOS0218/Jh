"use client";

import { useMemo, useState } from "react";
import { useData, useTxs } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { amountToInput, currentYM, formatTyping, money, monthLabel, monthRange, parseAmount } from "@/lib/format";
import { budgetSpent } from "@/lib/plan";
import type { Budget } from "@/lib/types";
import { BackBar } from "@/components/BackBar";
import { BizDot } from "@/components/Business";
import { Sheet, toast } from "@/components/ui";
import { IPie, IPlus } from "@/components/Icons";

export default function BudgetsPage() {
  const { budgets, businesses, activeId, catById, bizById } = useData();
  const ym = currentYM();
  const { data: txs } = useTxs(monthRange(ym));
  const [editing, setEditing] = useState<Budget | "new" | null>(null);

  const list = budgets.filter((b) => !activeId || b.business_id === activeId);
  const total = list.reduce((s, b) => s + b.amount, 0);
  const spent = list.reduce((s, b) => s + budgetSpent(b, txs), 0);

  return (
    <main className="page">
      <BackBar title="Presupuestos" right={<button className="btn small" onClick={() => setEditing("new")}><IPlus size={18} /> Nuevo</button>} />
      <p className="muted small" style={{ margin: "-6px 2px 12px" }}>
        Cuánto quieres gastar al mes en cada cosa (gasolina, mercado, salidas, publicidad…). Te aviso al llegar al 80%. Se suman a tu costo de vida en “Mi mes”.
      </p>

      {list.length > 0 && (
        <div className="grid3">
          <div className="kpi"><div className="k">Presupuesto</div><div className="v num">{money(total)}</div></div>
          <div className="kpi expense"><div className="k">Gastado</div><div className="v num">{money(spent)}</div></div>
          <div className="kpi profit"><div className="k">Disponible</div><div className="v num">{money(total - spent)}</div></div>
        </div>
      )}

      {!list.length && (
        <div className="empty">
          <div className="big-ico"><IPie size={28} /></div>
          <b>Sin presupuestos</b>
          Ej.: Gasolina $400.000 · Mercado $1.200.000 · Salidas $300.000.
          <div style={{ marginTop: 14 }}><button className="btn small" onClick={() => setEditing("new")}><IPlus size={16} /> Crear presupuesto</button></div>
        </div>
      )}

      {businesses.map((biz) => {
        const items = list.filter((b) => b.business_id === biz.id);
        if (!items.length) return null;
        return (
          <div key={biz.id}>
            <h3 className="h-section"><span style={{ display: "flex", alignItems: "center", gap: 8 }}><BizDot name={biz.name} color={biz.color} size={18} />{biz.name}</span><span>{monthLabel(ym, false)}</span></h3>
            <div className="list">
              {items.map((b) => {
                const sp = budgetSpent(b, txs);
                const pct = Math.min(100, (sp / b.amount) * 100);
                const color = sp >= b.amount ? "var(--expense)" : pct >= 80 ? "var(--warn)" : "var(--accent)";
                return (
                  <button key={b.id} className="row link" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }} onClick={() => setEditing(b)}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span className="t1">{b.name || catById(b.category_id)?.name || `Todo ${bizById(b.business_id)?.name}`}</span>
                      <span className="num" style={{ fontWeight: 750 }}>{money(sp)} <span className="muted" style={{ fontWeight: 500 }}>/ {money(b.amount)}</span></span>
                    </div>
                    <div className="progress" style={{ marginTop: 0 }}><div style={{ width: `${pct}%`, background: color }} /></div>
                    <span className="xsmall" style={{ color }}>
                      {sp >= b.amount ? `Te pasaste ${money(sp - b.amount)}` : `Quedan ${money(b.amount - sp)} · ${Math.round(pct)}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuevo presupuesto" : "Editar presupuesto"}>
        {editing !== null && <BudgetForm key={editing === "new" ? "new" : editing.id} budget={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </main>
  );
}

function BudgetForm({ budget, onDone }: { budget: Budget | null; onDone: () => void }) {
  const { businesses, categories, activeId, budgets, bump } = useData();
  const [businessId, setBusinessId] = useState(budget?.business_id ?? activeId ?? businesses.find((b) => b.name === "Personal")?.id ?? businesses[0]?.id);
  const [categoryId, setCategoryId] = useState<string | null>(budget?.category_id ?? null);
  const [amount, setAmount] = useState(amountToInput(budget?.amount ?? 0));
  const [name, setName] = useState(budget?.name ?? "");
  const [busy, setBusy] = useState(false);
  const cats = useMemo(() => categories.filter((c) => c.business_id === businessId && c.kind === "expense" && !c.archived), [categories, businessId]);
  const value = parseAmount(amount);

  const save = async () => {
    if (!value || !businessId) return;
    setBusy(true);
    const row = { business_id: businessId, category_id: cats.some((c) => c.id === categoryId) ? categoryId : null, amount: value, name: name.trim() || null };
    const { error } = budget
      ? await sb().from("budgets").update(row).eq("id", budget.id)
      : await sb().from("budgets").insert({ ...row, sort: budgets.length });
    setBusy(false);
    if (error) return toast(/budgets/.test(error.message) ? "Falta actualizar la base de datos (12-presupuestos-y-plan.sql)" : errorText(error));
    toast(budget ? "Presupuesto actualizado" : "Presupuesto creado");
    bump();
    onDone();
  };
  const remove = async () => {
    if (!budget || !confirm("¿Borrar este presupuesto?")) return;
    const { error } = await sb().from("budgets").delete().eq("id", budget.id);
    if (error) return toast(errorText(error));
    bump();
    onDone();
  };

  return (
    <div>
      <div className="field">
        <span className="lbl">Negocio</span>
        <div className="chips scroll">
          {businesses.map((b) => <button key={b.id} type="button" className={"chip" + (businessId === b.id ? " on" : "")} onClick={() => { setBusinessId(b.id); setCategoryId(null); }}>{b.name}</button>)}
        </div>
      </div>
      <div className="field">
        <span className="lbl">Categoría (vacío = todo el negocio)</span>
        <div className="chips">
          {cats.map((c) => <button key={c.id} type="button" className={"chip" + (categoryId === c.id ? " on" : "")} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>{c.name}</button>)}
        </div>
      </div>
      <div className="field">
        <label htmlFor="bud-amount">Presupuesto mensual</label>
        <input id="bud-amount" className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(formatTyping(e.target.value))} placeholder="Ej. 400.000" />
      </div>
      <div className="field">
        <label htmlFor="bud-name">Nombre (opcional)</label>
        <input id="bud-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Gasolina carro" />
      </div>
      <button className="btn" disabled={!value || busy} onClick={save}>{busy ? "Guardando…" : budget ? "Guardar cambios" : "Crear presupuesto"}</button>
      {budget && <button className="btn danger" style={{ marginTop: 10 }} onClick={remove}>Borrar presupuesto</button>}
    </div>
  );
}
