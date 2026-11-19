"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useData, useTxs } from "@/lib/store";
import { addMonths, currentYM, money, monthLabel, monthRange, monthShort, ymKey } from "@/lib/format";
import { summarize } from "@/lib/stats";
import { BusinessSwitcher, BizDot } from "@/components/Business";
import { TxList } from "@/components/TxList";
import { MonthBars } from "@/components/Charts";
import { AccountIcon } from "@/components/AccountIcon";
import { IAlert, IArrowDown, IArrowUp, IChevR, IWallet, IPlus } from "@/components/Icons";

export default function Home() {
  const { active, activeId, setActiveId, businesses, accounts, balances, toCOP, settings, catById, openTx } = useData();
  const now = currentYM();
  const from = monthRange(addMonths(now, -5)).from;
  const { data: txs, loading } = useTxs({ from, businessId: activeId });

  const myAccounts = accounts.filter((a) => !activeId || a.business_id === activeId);
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
      <div className="topbar">
        <BusinessSwitcher />
        <div className="actions">
          <Link href="/mas/cuentas" className="icon-btn" aria-label="Cuentas"><IWallet size={20} /></Link>
        </div>
      </div>

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
        <div className="dots">{order.map((id, i) => <span key={id ?? "g"} className={i === idx ? "on" : ""} />)}</div>
      </section>

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
              const bal = accounts.filter((a) => a.business_id === b.id).reduce((s, a) => s + toCOP(balances[a.id] ?? 0, a.currency), 0);
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
    </main>
  );
}
