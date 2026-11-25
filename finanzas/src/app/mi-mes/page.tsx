"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { money } from "@/lib/format";
import { monthlyCost, type CostLine } from "@/lib/plan";
import { BackBar } from "@/components/BackBar";
import { Seg } from "@/components/ui";

/** Cuánto cuesta tu vida (o tus negocios) cada mes */
export default function MyMonth() {
  const d = useData();
  const personal = d.businesses.find((b) => /personal/i.test(b.name));
  const [scope, setScope] = useState<"personal" | "all">("personal");
  const ids = scope === "personal" && personal ? [personal.id] : null;
  const cost = monthlyCost(
    { businesses: d.businesses, recurring: d.recurring, debts: d.debts, cards: d.cards, budgets: d.budgets, catById: d.catById, accById: d.accById, toCOP: d.toCOP },
    ids
  );
  const sum = (l: CostLine[]) => l.reduce((s, x) => s + x.amount, 0);
  const salary = d.settings.plan?.salary ?? 0;

  const Section = ({ title, lines, empty, link }: { title: string; lines: CostLine[]; empty: string; link: { href: string; label: string } }) => (
    <>
      <h3 className="h-section">{title} <Link href={link.href}>{link.label}</Link></h3>
      {lines.length ? (
        <div className="list">
          {lines.map((l) => (
            <div key={l.key} className="row" style={{ minHeight: 54 }}>
              <div className="main">
                <div className="t1">{l.label}</div>
                <div className="t2">{[l.detail, l.note].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="amt num" style={l.amount ? undefined : { color: "var(--muted)", fontWeight: 600 }}>{l.amount ? money(l.amount) : "—"}</div>
            </div>
          ))}
          <div className="row" style={{ minHeight: 46, background: "var(--surface)" }}>
            <div className="main"><b>Subtotal</b></div>
            <b className="num">{money(sum(lines))}</b>
          </div>
        </div>
      ) : (
        <p className="muted small" style={{ margin: "0 2px" }}>{empty}</p>
      )}
    </>
  );

  return (
    <main className="page">
      <BackBar title="Mi mes" fallback="/" />
      <p className="muted small" style={{ margin: "-6px 2px 14px" }}>
        Lo que cuesta {scope === "personal" ? "tu vida" : "todo (vida + negocios)"} cada mes: pagos fijos, cuotas de deudas y tarjetas, y tus presupuestos.
      </p>
      <Seg value={scope} onChange={setScope} options={[{ value: "personal", label: "Mi vida (Personal)" }, { value: "all", label: "Todo" }]} />

      <section className="hero" style={{ marginTop: 14 }}>
        <div className="label">{scope === "personal" ? "Tu vida cuesta al mes" : "Todo cuesta al mes"}</div>
        <div className="big num">{money(cost.total)}</div>
        <div className="sub">≈ {money(Math.round(cost.total / 30))} por día</div>
        <div className="pills">
          <div className="pill"><div className="k">Fijos</div><div className="v num">{money(sum(cost.fixed))}</div></div>
          <div className="pill"><div className="k">Deudas y tarjetas</div><div className="v num">{money(sum(cost.installments) + sum(cost.cards))}</div></div>
        </div>
        <div className="pills" style={{ marginTop: 10 }}>
          <div className="pill"><div className="k">Presupuestos</div><div className="v num">{money(sum(cost.budgets))}</div></div>
          <div className="pill"><div className="k">Tu sueldo</div><div className="v num">{salary ? money(salary) : "sin definir"}</div></div>
        </div>
        {salary > 0 && scope === "personal" && (
          <div className="sub" style={{ marginTop: 12 }}>
            {salary >= cost.total ? `Tu sueldo cubre tu mes y te sobran ${money(salary - cost.total)}.` : `Tu sueldo no alcanza: faltan ${money(cost.total - salary)} al mes.`}
          </div>
        )}
      </section>

      <Section title="Pagos fijos" lines={cost.fixed} empty="Sin pagos fijos. Agrega arriendo, servicios, suscripciones…" link={{ href: "/mas/pagos-fijos", label: "Editar" }} />
      <Section title="Cuotas de deudas" lines={cost.installments} empty="Ninguna deuda tiene cuota mensual definida." link={{ href: "/deudas", label: "Deudas" }} />
      <Section title="Tarjetas de crédito" lines={cost.cards} empty="Sin deuda en tarjetas." link={{ href: "/deudas", label: "Tarjetas" }} />
      <Section title="Presupuestos (gastos variables)" lines={cost.budgets} empty="Sin presupuestos. Crea uno para gasolina, mercado, salidas…" link={{ href: "/mas/presupuestos", label: "Editar" }} />
      {cost.noInstallment.length > 0 && (
        <>
          <h3 className="h-section">Deudas sin cuota (no suman)</h3>
          <div className="list">
            {cost.noInstallment.map((l) => (
              <div key={l.key} className="row" style={{ minHeight: 54 }}>
                <div className="main"><div className="t1">{l.label}</div><div className="t2">{l.detail}</div></div>
                <div className="amt num muted">{money(l.amount)}</div>
              </div>
            ))}
          </div>
          <p className="muted xsmall" style={{ margin: "8px 2px 0" }}>Ponles una cuota mensual en Deudas → Editar para que entren en tu mes.</p>
        </>
      )}

      <Link href="/plan" className="btn" style={{ marginTop: 22 }}>Ver mi plan de la plata →</Link>
    </main>
  );
}
