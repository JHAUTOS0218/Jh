"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useData, useTxs } from "@/lib/store";
import { addMonths, currentYM, money, monthLabel, monthRange, monthShort, ymKey } from "@/lib/format";
import { summarize } from "@/lib/stats";
import { BizDot } from "@/components/Business";
import { TopBar } from "@/components/TopBar";
import { daysUntilDue, debtDueDays, nextDueText } from "@/components/Debts";
import { RecurringRow, recurringStatus, useRecurringSheets } from "@/components/Recurring";
import { cardDueText } from "@/components/Cards";
import { mineAtCost, saleOf } from "@/components/Assets";
import { TxList } from "@/components/TxList";
import { MonthBars } from "@/components/Charts";
import { AccountIcon } from "@/components/AccountIcon";
import { IAlert, IArrowDown, IArrowUp, IChevR, IWallet, IPlus } from "@/components/Icons";

export default function Home() {
  const { active, activeId, setActiveId, businesses, accounts, balances, toCOP, settings, catById, openTx, debts, recurring, recurringPaid, moneyAccounts, cards, assets } = useData();
  const { sheets: recSheets, edit: editRec, pay: payRec } = useRecurringSheets();
  const now = currentYM();
  const from = monthRange(addMonths(now, -5)).from;
  const { data: txs, loading } = useTxs({ from, businessId: activeId });

  const myAccounts = moneyAccounts.filter((a) => !activeId || a.business_id === activeId);
  const myCards = cards.filter((c) => !activeId || c.card.business_id === activeId);
  const totalCOP = myAccounts.reduce((s, a) => s + toCOP(balances[a.id] ?? 0, a.currency), 0);
  const usdAccounts = myAccounts.filter((a) => a.currency === "USD");
  const usdTotal = usdAccounts.reduce((s, a) => s + (balances[a.id] ?? 0), 0);

  const { from: mFrom, to: mTo } = monthRange(now);
  const monthTxs = useMemo(() => txs.filter((t) => t.date >= mFrom && t.date <= mTo), [txs, mFrom, mTo]);
  const sum = summarize(monthTxs, activeId, catById, active);

  const bars = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const ym = addMonths(now, i - 5);
      const r = monthRange(ym);
      const s = summarize(txs.filter((t) => t.date >= r.from && t.date <= r.to), activeId, catById, active);
      return { label: monthShort(ym), income: s.income, expense: s.expense, profit: s.profit, current: ymKey(ym) === ymKey(now) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, activeId, active, catById]);

  const myDebts = debts.filter((d) => d.remaining > 0 && !d.excluded && (!activeId || d.business_id === activeId));
  const myAssets = assets.filter((x) => !activeId || x.business_id === activeId);
  const assetsMine = myAssets.reduce((s, x) => s + mineAtCost(x), 0);
  const assetsSale = myAssets.reduce((s, x) => s + saleOf(x), 0);
  const owedTotal = myDebts.filter((d) => d.direction === "owed").reduce((s, d) => s + toCOP(d.remaining, d.currency), 0);
  const oweTotal = myDebts.filter((d) => d.direction === "owe").reduce((s, d) => s + toCOP(d.remaining, d.currency), 0) + myCards.reduce((s, c) => s + c.totalDebt, 0);
  const cardAlerts = myCards.filter((c) => (c.card.pay_day && c.totalDebt > 0 && daysUntilDue(c.card.pay_day) <= 5) || (c.limit > 0 && c.available < c.limit * 0.1));
  const dueSoon = myDebts
    .filter((d) => { const n = debtDueDays(d); return n !== null && n <= 5; })
    .sort((a, b) => (debtDueDays(a) ?? 0) - (debtDueDays(b) ?? 0));
  const dueGroups = Object.values(
    dueSoon.reduce<Record<string, { key: string; first: (typeof dueSoon)[number]; installment: number }>>((acc, d) => {
      const key = `${d.direction}|${d.person.trim().toLowerCase()}|${d.next_due ?? d.due_day}`;
      acc[key] ??= { key, first: d, installment: 0 };
      acc[key].installment += toCOP(Math.min(d.installment ?? d.remaining, d.remaining), d.currency);
      return acc;
    }, {})
  );
  const firstName = (settings.display_name || "").trim().split(/\s+/)[0];

  const recPending = recurring
    .filter((r) => !recurringPaid[r.id] && (!activeId || r.business_id === activeId))
    .map((r) => ({ r, st: recurringStatus(r) }))
    .sort((a, b) => a.st.days - b.st.days);
  const recUrgent = recPending.filter((x) => x.st.days <= 3);

  const lowAccounts = myAccounts.filter((a) => a.min_balance != null && (balances[a.id] ?? 0) < a.min_balance);

  // --- deslizar la tarjeta para cambiar de negocio ---
  const order: (string | null)[] = [null, ...businesses.map((b) => b.id)];
  const idx = Math.max(0, order.indexOf(activeId));
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    const next = (idx + (dx < 0 ? 1 : -1) + order.length) % order.length;
    setActiveId(order[next]);
  };

  const recent = txs.slice(0, 6);

  return (
    <main className="page">
      <TopBar right={<Link href="/mas/cuentas" className="icon-btn" aria-label="Cuentas"><IWallet size={20} /></Link>} />

      {firstName && <p className="greet">Hola, <b style={{ color: "var(--ink)" }}>{firstName}</b> 👋</p>}
      <section className="hero" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="label">{active ? `Plata en ${active.name}` : "Plata total hoy"}</div>
        <div className="big num">{money(totalCOP)}</div>
        <div className="sub">
          {usdAccounts.length > 0
            ? <>Incluye {money(usdTotal, "USD")} (≈ {money(toCOP(usdTotal, "USD"))} a {money(settings.usd_rate)})</>
            : <>{myAccounts.length} {myAccounts.length === 1 ? "cuenta" : "cuentas"}</>}
        </div>
        <div className="pills">
          <div className="pill">
            <div className="k"><IArrowDown size={13} /> Ingresos {monthLabel(now, false).toLowerCase()}</div>
            <div className="v num">{money(sum.income)}</div>
          </div>
          <div className="pill">
            <div className="k"><IArrowUp size={13} /> Gastos {monthLabel(now, false).toLowerCase()}</div>
            <div className="v num">{money(sum.expense)}</div>
          </div>
        </div>
        <div className="silver-line" />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 13.5 }}>
          <span style={{ color: "rgba(255,255,255,0.75)" }}>{active?.partner_share ? "Tu utilidad del mes" : "Utilidad del mes"}</span>
          <b className="num">{money(sum.myProfit)}</b>
        </div>
        {(owedTotal > 0 || oweTotal > 0 || assetsMine > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13.5 }}>
            <span style={{ color: "rgba(255,255,255,0.75)" }}>{assetsMine > 0 ? "Patrimonio (con activos y deudas)" : "Neto con deudas"}</span>
            <b className="num">{money(totalCOP + owedTotal - oweTotal + assetsMine)}</b>
          </div>
        )}
        <div className="dots">{order.map((id, i) => <span key={id ?? "g"} className={i === idx ? "on" : ""} />)}</div>
      </section>

      {(owedTotal > 0 || oweTotal > 0) && (
        <Link href="/deudas" className="grid2" style={{ marginTop: 14 }}>
          <div className="kpi income"><div className="k">Me deben</div><div className="v num">{money(owedTotal)}</div></div>
          <div className="kpi expense"><div className="k">Debo</div><div className="v num">{money(oweTotal)}</div></div>
        </Link>
      )}

      {myAssets.length > 0 && (
        <Link href="/activos" className="kpi" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <span><span className="k">Activos ({myAssets.length})</span><span className="v num" style={{ display: "block" }}>{money(assetsSale)}</span></span>
          <span className="xsmall muted" style={{ textAlign: "right" }}>posible venta<br />costo {money(myAssets.reduce((s, x) => s + x.cost, 0))}</span>
        </Link>
      )}

      {dueGroups.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {dueGroups.map((g) => (
            <Link key={g.key} href={`/deudas?id=${g.first.id}`} className={"alert" + (g.first.direction === "owe" ? " danger" : "")} style={{ display: "flex" }}>
              <IAlert size={18} />
              <span>
                <b>{g.first.direction === "owe" ? `Pago a ${g.first.person}` : `Cobro a ${g.first.person}`}</b>: {nextDueText(g.first)}
                {g.installment > 0 ? <> · {money(g.installment)}</> : null}
              </span>
            </Link>
          ))}
        </div>
      )}

      {cardAlerts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {cardAlerts.map((c) => (
            <Link key={c.card.id} href="/deudas" className={"alert" + (c.available < 0 ? " danger" : "")} style={{ display: "flex" }}>
              <IAlert size={18} />
              <span>
                <b>{c.card.name}</b>:{" "}
                {c.card.pay_day && c.totalDebt > 0 && daysUntilDue(c.card.pay_day) <= 5 ? <>{cardDueText(c.card.pay_day)} · debes {money(c.totalDebt)}</> : <>te quedan {money(c.available)} disponibles</>}
              </span>
            </Link>
          ))}
        </div>
      )}

      {recUrgent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {recUrgent.map(({ r, st }) => (
            <button key={r.id} className={"alert" + (st.days < 0 ? " danger" : "")} style={{ display: "flex", width: "100%", textAlign: "left" }} onClick={() => payRec(r)}>
              <IAlert size={18} />
              <span style={{ flex: 1 }}><b>{r.name}</b>: {st.label.toLowerCase()} · {money(r.amount)}</span>
              <b style={{ flex: "none" }}>{r.kind === "income" ? "Recibí" : "Pagar"}</b>
            </button>
          ))}
        </div>
      )}

      {lowAccounts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {lowAccounts.map((a) => (
            <div key={a.id} className="alert">
              <IAlert size={18} />
              <span><b>{a.name}</b> está por debajo de su mínimo: tiene {money(balances[a.id] ?? 0, a.currency)} y el mínimo es {money(a.min_balance, a.currency)}.</span>
            </div>
          ))}
        </div>
      )}

      {!accounts.length && (
        <div className="card soft" style={{ marginTop: 18 }}>
          <div className="empty" style={{ padding: "14px 6px" }}>
            <div className="big-ico"><IWallet size={28} /></div>
            <b>Empieza creando tus cuentas</b>
            Agrega tus cuentas de Bancolombia, bolsillos, efectivo y dólares con su saldo de hoy.
            <div style={{ marginTop: 16 }}><Link className="btn" href="/mas/cuentas?nueva=1"><IPlus size={18} /> Crear mi primera cuenta</Link></div>
          </div>
        </div>
      )}

      {!activeId && businesses.length > 0 && accounts.length > 0 && (
        <>
          <h3 className="h-section">Negocios</h3>
          <div className="hscroll">
            {businesses.map((b) => {
              const bal = moneyAccounts.filter((a) => a.business_id === b.id).reduce((s, a) => s + toCOP(balances[a.id] ?? 0, a.currency), 0);
              const s = summarize(monthTxs, b.id, catById, b);
              return (
                <button key={b.id} className="biz-card" onClick={() => setActiveId(b.id)}>
                  <span className="bar" style={{ background: b.color }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <BizDot name={b.name} color={b.color} size={22} />
                    <span className="n">{b.name}</span>
                  </div>
                  <div className="b num">{money(bal)}</div>
                  <div className="p muted">
                    Utilidad del mes: <b className="num" style={{ color: s.myProfit < 0 ? "var(--expense)" : "var(--petrol-deep)" }}>{money(s.myProfit)}</b>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {active && active.partner_share > 0 && (
        <>
          <h3 className="h-section">Reparto con {active.partner_name || "el socio"}</h3>
          <div className="card">
            <div className="split"><span className="muted">Utilidad del negocio</span><b className="num">{money(sum.profit)}</b></div>
            <div className="split"><span className="muted">{active.partner_name || "Socio"} ({active.partner_share}%)</span><b className="num">{money(sum.partnerShare)}</b></div>
            <div className="split"><span className="muted">Ya le pagaste este mes</span><b className="num">{money(sum.partnerPaid)}</b></div>
            <div className="split"><span>Tu parte ({100 - active.partner_share}%)</span><b className="num" style={{ color: "var(--petrol-deep)" }}>{money(sum.myProfit)}</b></div>
          </div>
        </>
      )}

      {recPending.length > 0 && (
        <>
          <h3 className="h-section">Próximos pagos <Link href="/mas/pagos-fijos">Ver todos</Link></h3>
          <div className="list">
            {recPending.slice(0, 4).map(({ r }) => <RecurringRow key={r.id} r={r} onOpen={() => editRec(r)} onPay={() => payRec(r)} />)}
          </div>
        </>
      )}

      {myAccounts.length > 0 && (
        <>
          <h3 className="h-section">Cuentas <Link href="/mas/cuentas">Ver todas</Link></h3>
          <div className="list">
            {myAccounts.slice(0, 6).map((a) => (
              <Link key={a.id} href={`/movimientos?cuenta=${a.id}`} className="row link">
                <AccountIcon type={a.type} />
                <div className="main">
                  <div className="t1">{a.name}</div>
                  <div className="t2">{[a.bank, !activeId ? businesses.find((b) => b.id === a.business_id)?.name : null].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <div className={"amt num" + ((balances[a.id] ?? 0) < 0 ? " expense" : "")}>{money(balances[a.id] ?? 0, a.currency)}</div>
              </Link>
            ))}
          </div>
        </>
      )}

      {accounts.length > 0 && (
        <>
          <h3 className="h-section">Últimos 6 meses <Link href="/estadisticas">Estadísticas</Link></h3>
          <div className="card">
            <MonthBars data={bars} />
          </div>
        </>
      )}

      {accounts.length > 0 && (
        <>
          <h3 className="h-section">Últimos movimientos <Link href="/movimientos">Ver todos</Link></h3>
          {recent.length ? (
            <TxList txs={recent} showBiz={!activeId} grouped={false} />
          ) : (
            <div className="card soft">
              <div className="empty" style={{ padding: "10px" }}>
                {loading ? <div className="spinner" /> : <>
                  <b>Sin movimientos todavía</b>
                  Toca el botón <b>+</b> para registrar tu primer gasto o ingreso.
                  <div style={{ marginTop: 14 }}><button className="btn small" onClick={() => openTx()}>Registrar ahora <IChevR size={16} /></button></div>
                </>}
              </div>
            </div>
          )}
        </>
      )}
      {recSheets}
    </main>
  );
}
