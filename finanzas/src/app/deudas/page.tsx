"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/lib/store";
import { money } from "@/lib/format";
import type { Debt, DebtDirection } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BizDot } from "@/components/Business";
import { CatBars } from "@/components/Charts";
import { Seg, Sheet, initials } from "@/components/ui";
import { DebtForm, DebtDetail, DebtCategoriesEditor, nextDueText } from "@/components/Debts";
import { IPlus, IHandCoins, ITag } from "@/components/Icons";
import { PALETTE } from "@/lib/stats";
import { CardsSection } from "@/components/Cards";

export default function Page() {
  return <Suspense><Debts /></Suspense>;
}

function Debts() {
  const { debts, allDebts, active, activeId, businesses, toCOP, bizById, needsDbUpdate, cards } = useData();
  const params = useSearchParams();
  const router = useRouter();
  const [dir, setDir] = useState<DebtDirection>("owed");
  const [cat, setCat] = useState<string | null>(null);
  const [showPaid, setShowPaid] = useState(false);
  const [form, setForm] = useState<Debt | "new" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);

  // abrir una deuda desde un movimiento (/deudas?id=…)
  useEffect(() => {
    const id = params.get("id");
    if (id) {
      const d = allDebts.find((x) => x.id === id);
      if (d) setDir(d.direction);
      setDetailId(id);
      router.replace("/deudas");
    }
  }, [params, router, allDebts]);

  const inScope = useMemo(() => debts.filter((d) => !activeId || d.business_id === activeId), [debts, activeId]);
  const scoped = useMemo(() => inScope.filter((d) => !d.excluded), [inScope]);
  const apart = inScope.filter((d) => d.excluded && d.direction === dir && d.remaining > 0);
  const cop = (d: Debt) => toCOP(d.remaining, d.currency);
  const totalOwed = scoped.filter((d) => d.direction === "owed").reduce((s, d) => s + cop(d), 0);
  const scopedCards = cards.filter((c) => !activeId || c.card.business_id === activeId);
  const cardsDebt = scopedCards.reduce((s, c) => s + c.totalDebt, 0);
  const debtsOwe = scoped.filter((d) => d.direction === "owe").reduce((s, d) => s + cop(d), 0);
  const totalOwe = debtsOwe + cardsDebt;

  const ofDir = scoped.filter((d) => d.direction === dir);
  const pending = ofDir.filter((d) => d.remaining > 0);
  const visible = ofDir.filter((d) => (showPaid || d.remaining > 0) && (!cat || (d.category || "Sin categoría") === cat));

  // sumas por negocio y por categoría
  const byBiz = businesses
    .map((b, i) => ({ id: b.id, name: b.name, color: b.color || PALETTE[i % PALETTE.length], value: pending.filter((d) => d.business_id === b.id).reduce((s, d) => s + cop(d), 0) }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);
  const catMap = new Map<string, number>();
  pending.forEach((d) => { const k = d.category || "Sin categoría"; catMap.set(k, (catMap.get(k) ?? 0) + cop(d)); });
  const byCat = [...catMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ id: name, name, value, color: PALETTE[i % PALETTE.length] }));
  const dirTotal = dir === "owed" ? totalOwed : debtsOwe;

  // agrupar por persona
  const people = new Map<string, Debt[]>();
  visible.forEach((d) => { const k = d.person.trim().toLowerCase(); people.set(k, [...(people.get(k) ?? []), d]); });
  const groups = [...people.values()]
    .map((list) => ({ person: list[0].person, list, total: list.reduce((s, d) => s + cop(d), 0) }))
    .sort((a, b) => b.total - a.total);

  const detail = allDebts.find((d) => d.id === detailId) ?? null;

  if (needsDbUpdate) {
    return (
      <main className="page">
        <TopBar />
        <div className="empty"><b>Falta activar Deudas</b>Corre el archivo 02-deudas-y-apariencia.sql en Supabase (te explico cómo en la guía).</div>
      </main>
    );
  }

  return (
    <main className="page">
      <TopBar right={<button className="icon-btn" onClick={() => setForm("new")} aria-label="Nueva deuda"><IPlus size={20} /></button>} />
      <h1 className="title" style={{ margin: "6px 2px 14px" }}>Deudas</h1>

      <div className="debt-sum">
        <button className="box owed" style={{ textAlign: "left", outline: dir === "owed" ? "2px solid var(--income)" : "none" }} onClick={() => setDir("owed")}>
          <div className="k">Me deben{active ? ` · ${active.name}` : ""}</div>
          <div className="v num">{money(totalOwed)}</div>
        </button>
        <button className="box owe" style={{ textAlign: "left", outline: dir === "owe" ? "2px solid var(--expense)" : "none" }} onClick={() => setDir("owe")}>
          <div className="k">Yo debo{active ? ` · ${active.name}` : ""}</div>
          <div className="v num">{money(totalOwe)}</div>
        </button>
      </div>
      <div className="net-line">
        <span className="muted">Balance (me deben − debo)</span>
        <b className="num" style={{ color: totalOwed - totalOwe < 0 ? "var(--expense)" : "var(--income)" }}>{money(totalOwed - totalOwe, "COP", { sign: true })}</b>
      </div>

      <div style={{ marginTop: 16 }}>
        <Seg value={dir} onChange={(v) => { setDir(v); setCat(null); }} options={[{ value: "owed", label: `Me deben (${ofDirCount(scoped, "owed")})`, cls: "income" }, { value: "owe", label: `Yo debo (${ofDirCount(scoped, "owe") + scopedCards.filter((c) => c.totalDebt > 0).length})`, cls: "expense" }]} />
      </div>

      {dir === "owe" && <CardsSection />}
      {dir === "owe" && cardsDebt > 0 && (
        <div className="net-line" style={{ marginTop: 0 }}>
          <span className="muted">Deuda en tarjetas</span><b className="num" style={{ color: "var(--expense)" }}>{money(cardsDebt)}</b>
        </div>
      )}

      {!activeId && byBiz.length > 0 && (
        <>
          <h3 className="h-section">{dir === "owed" ? "Me deben" : "Debo"} por negocio</h3>
          <div className="card"><CatBars data={byBiz} total={dirTotal} /></div>
        </>
      )}

      {byCat.length > 0 && (
        <>
          <h3 className="h-section">Por categoría <button onClick={() => setCatsOpen(true)}><ITag size={14} style={{ verticalAlign: -2 }} /> Editar categorías</button></h3>
          <div className="card"><CatBars data={byCat} total={dirTotal} /></div>
        </>
      )}

      <h3 className="h-section">{dir === "owed" ? "Quién me debe" : "Préstamos y otras deudas"}</h3>
      {byCat.length > 1 && (
        <div className="chips scroll" style={{ marginBottom: 10 }}>
          <button className={"chip" + (!cat ? " on" : "")} onClick={() => setCat(null)}>Todas</button>
          {byCat.map((c) => <button key={c.id} className={"chip" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>{c.name}</button>)}
        </div>
      )}

      {groups.length === 0 && (
        <div className="empty">
          <div className="big-ico"><IHandCoins size={28} /></div>
          <b>{dir === "owed" ? "Nadie te debe" : "Sin préstamos ni otras deudas"}{active ? ` en ${active.name}` : ""}</b>
          {dir === "owed" ? "Registra préstamos que hiciste o ventas a crédito." : "Registra préstamos, créditos o lo que le debes a proveedores."}
          <div style={{ marginTop: 14 }}><button className="btn small" onClick={() => setForm("new")}><IPlus size={16} /> Agregar</button></div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.person} className="list" style={{ marginBottom: 12 }}>
          <div className="person-head">
            <span className="n"><span className="avatar">{initials(g.person)}</span>{g.person}</span>
            <b className="num">{money(g.total)}</b>
          </div>
          {g.list.map((d) => {
            const b = bizById(d.business_id);
            const pct = d.total_amount ? Math.min(100, (d.paid / d.total_amount) * 100) : 0;
            const due = d.remaining > 0 ? nextDueText(d) : null;
            return (
              <button key={d.id} className="row link" style={{ alignItems: "flex-start" }} onClick={() => setDetailId(d.id)}>
                {b && <BizDot name={b.name} color={b.color} size={30} />}
                <div className="main">
                  <div className="t1">{d.description || d.category || "Deuda"}</div>
                  <div className="t2">{[b?.name, d.category, due].filter(Boolean).join(" · ")}</div>
                  <div className="progress"><div style={{ width: `${pct}%`, background: d.remaining <= 0 ? "var(--income)" : undefined }} /></div>
                  <div className="xsmall muted" style={{ marginTop: 4 }}>
                    {d.remaining <= 0 ? "Saldada ✓" : `Pagado ${money(d.paid, d.currency)} de ${money(d.total_amount, d.currency)}`}
                  </div>
                </div>
                <div className={"amt num " + (d.direction === "owed" ? "income" : "expense")}>
                  {money(d.remaining, d.currency)}
                  {d.installment ? <span className="s">cuota {money(d.installment, d.currency)}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      {apart.length > 0 && (
        <>
          <h3 className="h-section">Aparte · no suman en los totales</h3>
          <div className="list" style={{ opacity: 0.85 }}>
            {apart.map((d) => (
              <button key={d.id} className="row link" onClick={() => setDetailId(d.id)}>
                <div className="main">
                  <div className="t1">{d.person}</div>
                  <div className="t2">{[d.description, bizById(d.business_id)?.name, d.category].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="amt num" style={{ color: "var(--muted)" }}>{money(d.remaining, d.currency)}<span className="s">aparte</span></div>
              </button>
            ))}
          </div>
        </>
      )}

      {ofDir.some((d) => d.remaining <= 0) && (
        <button className="link-btn" style={{ display: "block", margin: "8px auto 0" }} onClick={() => setShowPaid(!showPaid)}>
          {showPaid ? "Ocultar saldadas" : "Ver saldadas"}
        </button>
      )}

      <Sheet open={form !== null} onClose={() => setForm(null)} full title={form === "new" ? "Nueva deuda" : "Editar deuda"}>
        {form !== null && <DebtForm key={form === "new" ? "new" : form.id} debt={form === "new" ? null : form} defaultDirection={dir} onDone={() => setForm(null)} />}
      </Sheet>
      <Sheet open={!!detail} onClose={() => setDetailId(null)} full title={detail ? detail.person : ""}>
        {detail && <DebtDetail key={detail.id} debt={detail} onEdit={() => { setForm(detail); setDetailId(null); }} onClose={() => setDetailId(null)} />}
      </Sheet>
      <Sheet open={catsOpen} onClose={() => setCatsOpen(false)} title="Categorías de deudas">
        <DebtCategoriesEditor />
      </Sheet>
    </main>
  );
}

const ofDirCount = (list: Debt[], dir: DebtDirection) => list.filter((d) => d.direction === dir && d.remaining > 0).length;
