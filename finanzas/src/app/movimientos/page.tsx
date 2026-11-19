"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useData, useTxs } from "@/lib/store";
import { currentYM, money, monthRange, type YM } from "@/lib/format";
import type { TxKind } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { TxList } from "@/components/TxList";
import { MonthNav } from "@/components/ui";
import { AccountSheet } from "@/components/TxForm";
import { IClose, ISearch, IList, IDownload } from "@/components/Icons";
import { txsToCSV, downloadText } from "@/lib/csv";

export default function Page() {
  return <Suspense><Movements /></Suspense>;
}

function Movements() {
  const params = useSearchParams();
  const router = useRouter();
  const { activeId, accById, catById, bizById } = useData();
  const [ym, setYm] = useState<YM>(currentYM());
  const [kind, setKind] = useState<"all" | TxKind>("all");
  const [search, setSearch] = useState("");
  const [pickAcc, setPickAcc] = useState(false);
  const accountId = params.get("cuenta");
  const account = accById(accountId);

  const searching = search.trim().length > 0;
  const range = monthRange(ym);
  const { data, loading } = useTxs(searching ? { businessId: activeId } : { ...range, businessId: activeId });

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    const digits = s.replace(/[^\d]/g, "");
    return data.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (accountId && t.account_id !== accountId && t.to_account_id !== accountId) return false;
      if (!s) return true;
      const hay = [t.description, t.note, catById(t.category_id)?.name, accById(t.account_id)?.name, accById(t.to_account_id)?.name, bizById(t.business_id)?.name]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s) || (digits.length >= 3 && String(Math.round(t.amount)).includes(digits));
    });
  }, [data, kind, accountId, search, catById, accById, bizById]);

  const inc = list.filter((t) => t.kind === "income" && (!activeId || t.business_id === activeId)).reduce((s, t) => s + t.amount_cop, 0);
  const exp = list.filter((t) => t.kind === "expense" && (!activeId || t.business_id === activeId)).reduce((s, t) => s + t.amount_cop, 0);

  const setAccount = (id: string | null) => router.replace(id ? `/movimientos?cuenta=${id}` : "/movimientos");

  const exportCSV = () => {
    const csv = txsToCSV(list, { biz: bizById, acc: accById, cat: catById });
    downloadText(`movimientos-${searching ? "busqueda" : range.from.slice(0, 7)}.csv`, csv);
  };

  return (
    <main className="page">
      <TopBar right={<button className="icon-btn" onClick={exportCSV} aria-label="Exportar"><IDownload size={19} /></button>} />
      <h1 className="title" style={{ margin: "6px 2px 14px" }}>Movimientos</h1>

      <div className="search" style={{ marginBottom: 12 }}>
        <ISearch />
        <input className="input" placeholder="Buscar: gasolina, Mazda, 80000…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {searching && (
          <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: 12, color: "var(--muted)" }} aria-label="Limpiar"><IClose size={20} /></button>
        )}
      </div>

      {!searching && <div style={{ marginBottom: 12 }}><MonthNav value={ym} onChange={setYm} /></div>}

      <div className="chips scroll" style={{ marginBottom: 6 }}>
        {([["all", "Todos"], ["expense", "Gastos"], ["income", "Ingresos"], ["transfer", "Transferencias"]] as const).map(([v, l]) => (
          <button key={v} className={"chip" + (kind === v ? " on" : "")} onClick={() => setKind(v)}>{l}</button>
        ))}
        <button className={"chip" + (account ? " on" : " outline")} onClick={() => (account ? setAccount(null) : setPickAcc(true))}>
          {account ? <>{account.name} <IClose size={14} /></> : "Cuenta…"}
        </button>
      </div>

      <div className="grid2" style={{ margin: "12px 0 4px" }}>
        <div className="kpi income"><div className="k">Ingresos</div><div className="v num">{money(inc)}</div></div>
        <div className="kpi expense"><div className="k">Gastos</div><div className="v num">{money(exp)}</div></div>
      </div>

      {loading && !data.length ? (
        <div style={{ padding: 40 }}><div className="spinner" /></div>
      ) : list.length ? (
        <>
          <TxList txs={list} showBiz={!activeId} />
          <p className="muted xsmall" style={{ textAlign: "center", marginTop: 16 }}>Desliza un movimiento a la izquierda para editarlo o borrarlo.</p>
        </>
      ) : (
        <div className="empty">
          <div className="big-ico"><IList size={28} /></div>
          <b>No hay movimientos</b>
          {searching ? "Nada coincide con tu búsqueda." : "No hay movimientos en este mes con estos filtros."}
        </div>
      )}

      <AccountSheet open={pickAcc} onClose={() => setPickAcc(false)} onPick={(a) => { setAccount(a.id); setPickAcc(false); }} />
    </main>
  );
}
