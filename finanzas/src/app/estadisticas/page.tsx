"use client";

import { useMemo, useState } from "react";
import { useData, useTxs } from "@/lib/store";
import { addMonths, currentYM, money, monthLabel, monthRange, monthShort, ymKey, type YM } from "@/lib/format";
import { byCategory, summarize } from "@/lib/stats";
import { BizDot } from "@/components/Business";
import { TopBar } from "@/components/TopBar";
import { MonthBars, Donut, CatBars } from "@/components/Charts";
import { MonthNav, Seg } from "@/components/ui";
import { AccountIcon } from "@/components/AccountIcon";

export default function Stats() {
  const { active, activeId, businesses, moneyAccounts: accounts, balances, catById } = useData();
  const [ym, setYm] = useState<YM>(currentYM());
  const [catKind, setCatKind] = useState<"expense" | "income">("expense");

  const from = monthRange(addMonths(ym, -5)).from;
  const to = monthRange(ym).to;
  const { data: txs, loading } = useTxs({ from, to, businessId: activeId });

  const r = monthRange(ym);
  const monthTxs = useMemo(() => txs.filter((t) => t.date >= r.from && t.date <= r.to), [txs, r.from, r.to]);
  const prevR = monthRange(addMonths(ym, -1));
  const prevTxs = useMemo(() => txs.filter((t) => t.date >= prevR.from && t.date <= prevR.to), [txs, prevR.from, prevR.to]);

  const sum = summarize(monthTxs, activeId, catById, active);
  const prev = summarize(prevTxs, activeId, catById, active);

  const bars = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const m = addMonths(ym, i - 5);
        const rr = monthRange(m);
        const s = summarize(txs.filter((t) => t.date >= rr.from && t.date <= rr.to), activeId, catById, active);
        return { label: monthShort(m), income: s.income, expense: s.expense, profit: s.profit, current: ymKey(m) === ymKey(ym), ym: m };
      }),
    [txs, ym, activeId, catById, active]
  );
  const avgProfit = Math.round(bars.reduce((s, b) => s + b.profit, 0) / 6);

  const slices = byCategory(monthTxs, catKind, activeId, catById);
  const sliceTotal = slices.reduce((s, x) => s + x.value, 0);

  const delta = (a: number, b: number) => {
    if (!b) return null;
    const p = Math.round(((a - b) / Math.abs(b)) * 100);
    return `${p > 0 ? "+" : ""}${p}% vs ${monthShort(addMonths(ym, -1))}`;
  };

  const myAccounts = accounts.filter((a) => !activeId || a.business_id === activeId);

  return (
    <main className="page">
      <TopBar />
      <h1 className="title" style={{ margin: "6px 2px 14px" }}>Estadísticas</h1>
      <MonthNav value={ym} onChange={setYm} />

      <div className="grid3" style={{ marginTop: 14 }}>
        <div className="kpi income"><div className="k">Ingresos</div><div className="v num">{money(sum.income)}</div><div className="xsmall muted">{delta(sum.income, prev.income) ?? " "}</div></div>
        <div className="kpi expense"><div className="k">Egresos</div><div className="v num">{money(sum.expense)}</div><div className="xsmall muted">{delta(sum.expense, prev.expense) ?? " "}</div></div>
        <div className="kpi profit"><div className="k">Utilidad</div><div className="v num" style={sum.profit < 0 ? { color: "var(--expense)" } : undefined}>{money(sum.profit)}</div><div className="xsmall muted">{sum.income ? `Margen ${Math.round((sum.profit / sum.income) * 100)}%` : " "}</div></div>
      </div>

      {active && active.partner_share > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="split"><span className="muted">{active.partner_name || "Socio"} ({active.partner_share}%)</span><b className="num">{money(sum.partnerShare)}</b></div>
          <div className="split"><span className="muted">Pagado al socio</span><b className="num">{money(sum.partnerPaid)}</b></div>
          <div className="split"><span className="muted">Pendiente por pagarle</span><b className="num">{money(Math.max(0, sum.partnerShare - sum.partnerPaid))}</b></div>
          <div className="split"><span>Tu utilidad ({100 - active.partner_share}%)</span><b className="num" style={{ color: "var(--accent)" }}>{money(sum.myProfit)}</b></div>
        </div>
      )}

      <h3 className="h-section">Utilidad últimos 6 meses</h3>
      <div className="card">
        {loading && !txs.length ? <div className="spinner" /> : <MonthBars data={bars} onPick={(i) => setYm(bars[i].ym)} />}
        <div className="split" style={{ marginTop: 8 }}>
          <span className="muted">Promedio mensual</span>
          <b className="num" style={{ color: avgProfit < 0 ? "var(--expense)" : "var(--accent)" }}>{money(avgProfit)}</b>
        </div>
      </div>

      {!activeId && (
        <>
          <h3 className="h-section">Utilidad por negocio · {monthLabel(ym, false)}</h3>
          <div className="list">
            {businesses.map((b) => {
              const s = summarize(monthTxs, b.id, catById, b);
              return (
                <div key={b.id} className="row">
                  <BizDot name={b.name} color={b.color} size={36} />
                  <div className="main">
                    <div className="t1">{b.name}</div>
                    <div className="t2 num">Ingresos {money(s.income)} · Egresos {money(s.expense)}</div>
                  </div>
                  <div className={"amt num " + (s.myProfit < 0 ? "expense" : "")} style={s.myProfit >= 0 ? { color: "var(--accent)" } : undefined}>
                    {money(s.myProfit)}
                    {b.partner_share > 0 && <span className="s">tu parte</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3 className="h-section">{catKind === "expense" ? "Gastos" : "Ingresos"} por categoría</h3>
      <Seg value={catKind} onChange={setCatKind} options={[{ value: "expense", label: "Gastos", cls: "expense" }, { value: "income", label: "Ingresos", cls: "income" }]} />
      <div className="card" style={{ marginTop: 10 }}>
        {slices.length ? (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <Donut data={slices} total={sliceTotal} label={catKind === "expense" ? "Gastos" : "Ingresos"} />
            </div>
            <CatBars data={slices} total={sliceTotal} />
          </>
        ) : (
          <div className="empty" style={{ padding: 16 }}>Sin {catKind === "expense" ? "gastos" : "ingresos"} en {monthLabel(ym, false).toLowerCase()}.</div>
        )}
      </div>

      {myAccounts.length > 0 && (
        <>
          <h3 className="h-section">{active ? `Cuentas de ${active.name}` : "Cuentas"}</h3>
          <div className="list">
            {myAccounts.map((a) => (
              <div key={a.id} className="row">
                <AccountIcon type={a.type} />
                <div className="main"><div className="t1">{a.name}</div><div className="t2">{a.bank || "—"}</div></div>
                <div className={"amt num" + ((balances[a.id] ?? 0) < 0 ? " expense" : "")}>{money(balances[a.id] ?? 0, a.currency)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
