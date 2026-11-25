"use client";

import { useData } from "@/lib/store";
import { money } from "@/lib/format";
import { accountTypeLabel, type Account } from "@/lib/types";
import { BackBar } from "@/components/BackBar";
import { AccountIcon } from "@/components/AccountIcon";

/** Suma de cuentas por banco para comparar con lo que muestra la app del banco */
export default function Reconcile() {
  const { moneyAccounts: accounts, balances, bizById, cards } = useData();

  const groups = new Map<string, Account[]>();
  for (const a of accounts) {
    const key = a.bank?.trim() || (a.type === "cash" ? "Efectivo" : "Sin banco");
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));

  return (
    <main className="page">
      <BackBar title="Cuadre por banco" />
      <p className="muted small" style={{ margin: "-6px 2px 8px" }}>
        Compara cada total con el saldo que te muestra el banco. Si no cuadra, entra a la cuenta en <b>Cuentas</b> y escribe el saldo real.
      </p>
      {!sorted.length && <div className="empty">No tienes cuentas todavía.</div>}
      {cards.length > 0 && (
        <>
          <h3 className="h-section">Tarjetas de crédito</h3>
          <div className="list">
            {cards.map((c) => (
              <div key={c.card.id} className="row">
                <div className="main"><div className="t1">{c.card.name}</div><div className="t2">{c.card.bank || "—"}{c.limit ? ` · disponible ${money(c.available)}` : ""}</div></div>
                <div className="amt num expense">
                  -{money(c.debtCOP)}
                  {c.usd && <span className="s">-{money(c.debtUSD, "USD")}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {sorted.map(([bank, list]) => {
        const cop = list.filter((a) => a.currency === "COP").reduce((s, a) => s + (balances[a.id] ?? 0), 0);
        const usd = list.filter((a) => a.currency === "USD").reduce((s, a) => s + (balances[a.id] ?? 0), 0);
        const hasUsd = list.some((a) => a.currency === "USD");
        const hasCop = list.some((a) => a.currency === "COP");
        return (
          <div key={bank}>
            <h3 className="h-section">{bank}</h3>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {list.map((a) => (
                <div key={a.id} className="row" style={{ borderBottom: "1px solid var(--line)" }}>
                  <AccountIcon type={a.type} size={34} />
                  <div className="main">
                    <div className="t1">{a.name}</div>
                    <div className="t2">{accountTypeLabel(a.type)} · {bizById(a.business_id)?.name}</div>
                  </div>
                  <div className={"amt num" + ((balances[a.id] ?? 0) < 0 ? " expense" : "")}>{money(balances[a.id] ?? 0, a.currency)}</div>
                </div>
              ))}
              <div style={{ padding: "12px 14px", background: "var(--petrol-soft)" }}>
                {hasCop && <div className="split" style={{ padding: "2px 0" }}><b>Total en {bank}</b><b className="num" style={{ fontSize: 17, color: "var(--accent)" }}>{money(cop)}</b></div>}
                {hasUsd && <div className="split" style={{ padding: "2px 0", borderTop: 0 }}><b>{hasCop ? "Total en dólares" : `Total en ${bank}`}</b><b className="num" style={{ fontSize: 17, color: "var(--accent)" }}>{money(usd, "USD")}</b></div>}
              </div>
            </div>
          </div>
        );
      })}
    </main>
  );
}
