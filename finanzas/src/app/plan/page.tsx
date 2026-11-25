"use client";

import { useState } from "react";
import Link from "next/link";
import { useData, useTxs } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { addMonths, amountToInput, currentYM, formatTyping, money, monthLabel, monthRange, parseAmount } from "@/lib/format";
import { buildPlan } from "@/lib/plan";
import type { PlanSettings } from "@/lib/types";
import { BackBar } from "@/components/BackBar";
import { Seg, Sheet, toast } from "@/components/ui";
import { AccountSheet } from "@/components/TxForm";
import { IChevR } from "@/components/Icons";

export default function PlanPage() {
  const d = useData();
  const [which, setWhich] = useState<"now" | "prev">("now");
  const [adjust, setAdjust] = useState(false);
  const ym = which === "now" ? currentYM() : addMonths(currentYM(), -1);
  const { data: monthTxs, loading } = useTxs(monthRange(ym));
  const { data: prevTxs } = useTxs(monthRange(addMonths(ym, -1)));
  const personal = d.businesses.find((b) => /personal/i.test(b.name));

  const p = buildPlan({
    ctx: { businesses: d.businesses, recurring: d.recurring, debts: d.debts, cards: d.cards, budgets: d.budgets, catById: d.catById, accById: d.accById, toCOP: d.toCOP },
    plan: d.settings.plan ?? {},
    monthTxs, prevMonthTxs: prevTxs, balances: d.balances,
    personalId: personal?.id ?? null, pendingCount: d.pendingCount,
  });
  const debtsToPay = p.debts.filter((x) => x.pay > 0);
  const toneClass = { ok: "alert ok", warn: "alert", danger: "alert danger", info: "alert info" } as const;

  const Step = ({ n, title, amount, children }: { n: number; title: string; amount: number; children?: React.ReactNode }) => (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="avatar" style={{ width: 30, height: 30, fontSize: 13 }}>{n}</span>
        <div style={{ flex: 1, minWidth: 0 }}><b>{title}</b></div>
        <b className="num" style={{ fontSize: 17, color: "var(--accent)" }}>{money(amount)}</b>
      </div>
      {children && <div className="small muted" style={{ marginTop: 8, paddingLeft: 42 }}>{children}</div>}
    </div>
  );

  return (
    <main className="page">
      <BackBar title="Plan de la plata" fallback="/" right={<button className="btn small secondary" onClick={() => setAdjust(true)}>Ajustar</button>} />
      <Seg value={which} onChange={setWhich} options={[{ value: "now", label: `${monthLabel(currentYM(), false)} (va corriendo)` }, { value: "prev", label: monthLabel(addMonths(currentYM(), -1), false) }]} />

      <section className="hero" style={{ marginTop: 14 }}>
        <div className="label">Ganancia de tus negocios · {monthLabel(ym)}</div>
        <div className="big num">{loading && !monthTxs.length ? "…" : money(p.profit)}</div>
        <div className="sub">{p.profitByBiz.map((b) => `${b.name} ${money(b.profit)}`).join(" · ")}</div>
        <div className="pills">
          <div className="pill"><div className="k">Costos fijos</div><div className="v num">{money(p.costOfLiving)}</div></div>
          <div className="pill"><div className="k">Te sobra para repartir</div><div className="v num">{money(p.leftover)}</div></div>
        </div>
      </section>

      <h3 className="h-section">Qué hacer con la ganancia</h3>
      <Step n={1} title="Págate tu sueldo" amount={Math.min(p.salary, Math.max(0, p.profit))}>
        {d.settings.plan?.salary ? "Tu sueldo definido." : "Igual a tu costo de vida. Puedes definir tu sueldo en Ajustar."}
        {p.shortfall > 0 && <> Faltan <b style={{ color: "var(--expense)" }}>{money(p.shortfall)}</b> para completarlo.</>}
        {" "}Pásalo de los bolsillos del negocio a tu cuenta personal con una transferencia.
      </Step>
      <Step n={2} title="Fondo de emergencia" amount={p.emergency.put}>
        {p.emergency.accountName
          ? <>En <b>{p.emergency.accountName}</b> tienes {money(p.emergency.balance)} de {money(p.emergency.target)} ({p.emergency.months} meses de tu costo de vida).</>
          : <>Elige en Ajustar la cuenta o bolsillo donde guardas tu fondo. Meta: {p.emergency.months} meses ({money(p.emergency.target)}).</>}
      </Step>
      <Step n={3} title="Abonar a deudas" amount={debtsToPay.reduce((s, x) => s + x.pay, 0)}>
        {p.debts.length === 0 ? "No tienes deudas activas 🎉" : debtsToPay.length === 0 ? "Este mes no alcanza para abonos extra; paga al menos las cuotas." : "En este orden:"}
      </Step>
      {debtsToPay.length > 0 && (
        <div className="list" style={{ marginBottom: 10 }}>
          {debtsToPay.map((x, i) => (
            <div key={x.key} className="row" style={{ alignItems: "flex-start" }}>
              <span className="tag" style={{ marginTop: 2 }}>{i + 1}</span>
              <div className="main">
                <div className="t1">{x.label}</div>
                <div className="t2" style={{ whiteSpace: "normal" }}>{x.detail} · {x.reason}</div>
              </div>
              <div className="amt num">{money(x.pay)}<span className="s">de {money(x.remaining)}</span></div>
            </div>
          ))}
        </div>
      )}
      <Step n={4} title="Reinvertir en los negocios" amount={p.reinvest}>
        {d.settings.plan?.pct_reinvest ?? 20}% de lo que sobra: inventario, publicidad, compra del próximo carro u oro.
      </Step>
      <Step n={5} title="Para disfrutar" amount={p.fun}>10% de lo que sobra, sin culpa.</Step>
      {p.extraSavings > 0 && <Step n={6} title="Ahorro o inversión extra" amount={p.extraSavings}>Ya no hay deudas que abonar con esto: ahórralo o inviértelo.</Step>}

      <h3 className="h-section">Recomendaciones</h3>
      {p.tips.map((t, i) => <div key={i} className={toneClass[t.tone]} style={{ marginTop: i ? 8 : 0 }}><span>{t.text}</span></div>)}

      <Link href="/mi-mes" className="row link card" style={{ marginTop: 16, borderRadius: 18 }}>
        <div className="main"><div className="t1">Ver mis costos fijos</div><div className="t2">Pagos fijos, cuotas, tarjetas y presupuestos</div></div>
        <IChevR size={18} className="chev" />
      </Link>
      <p className="muted xsmall" style={{ marginTop: 14 }}>
        Es una guía con reglas generales de finanzas (págate primero, fondo de 3 a 6 meses, deudas más caras primero, uso de tarjetas bajo el 30%). No es asesoría financiera personalizada. Para que sea más exacta, ponle el interés mensual a tus deudas y la cuota a tus tarjetas.
      </p>

      <Sheet open={adjust} onClose={() => setAdjust(false)} title="Ajustar mi plan">
        {adjust && <PlanForm onDone={() => setAdjust(false)} />}
      </Sheet>
    </main>
  );
}

function PlanForm({ onDone }: { onDone: () => void }) {
  const { settings, session, accById, bump } = useData();
  const plan = settings.plan ?? {};
  const [salary, setSalary] = useState(amountToInput(plan.salary ?? 0));
  const [months, setMonths] = useState(String(plan.emergency_months ?? 3));
  const [reinvest, setReinvest] = useState(String(plan.pct_reinvest ?? 20));
  const [accId, setAccId] = useState<string | null>(plan.emergency_account_id ?? null);
  const [officeId, setOfficeId] = useState<string | null>(plan.office_account_id ?? null);
  const [office, setOffice] = useState(amountToInput(plan.office_monthly ?? 0));
  const [pick, setPick] = useState<null | "emergency" | "office">(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const next: PlanSettings = {
      ...plan,
      office_account_id: officeId,
      office_monthly: parseAmount(office) || undefined,
      salary: parseAmount(salary) || undefined,
      emergency_months: Math.min(12, Math.max(1, parseInt(months, 10) || 3)),
      pct_reinvest: Math.min(80, Math.max(0, parseInt(reinvest, 10) || 0)),
      emergency_account_id: accId,
    };
    const { error } = await sb().from("settings").upsert({ user_id: session!.user.id, plan: next });
    setBusy(false);
    if (error) return toast(/plan/.test(error.message) ? "Falta actualizar la base de datos (12-presupuestos-y-plan.sql)" : errorText(error));
    toast("Plan actualizado");
    bump();
    onDone();
  };

  return (
    <div>
      <div className="field">
        <label htmlFor="plan-salary">¿Cuánto te quieres pagar al mes? (tu sueldo)</label>
        <input id="plan-salary" className="input num" inputMode="numeric" value={salary} onChange={(e) => setSalary(formatTyping(e.target.value))} placeholder="Vacío = igual a tu costo de vida" />
      </div>
      <div className="field">
        <span className="lbl">Cuenta o bolsillo del fondo de emergencia</span>
        <button type="button" className="picker" onClick={() => setPick("emergency")}>
          <span className={accById(accId) ? "v" : "ph"}>{accById(accId)?.name ?? "Elegir cuenta"}</span>
          <IChevR size={18} className="chev" />
        </button>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="plan-months">Meses de fondo (meta)</label>
          <input id="plan-months" className="input num" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </div>
        <div className="field">
          <label htmlFor="plan-reinvest">% para reinvertir</label>
          <input id="plan-reinvest" className="input num" inputMode="numeric" value={reinvest} onChange={(e) => setReinvest(e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </div>
      </div>
      <h3 className="h-section">Oficina</h3>
      <p className="muted small" style={{ marginTop: 0 }}>Cuando vendas un carro, la app aparta esta plata para la oficina si ese mes todavía no está completa.</p>
      <div className="grid2">
        <div className="field">
          <span className="lbl">Bolsillo de la oficina</span>
          <button type="button" className="picker" onClick={() => setPick("office")}>
            <span className={accById(officeId) ? "v" : "ph"}>{accById(officeId)?.name ?? "Elegir"}</span>
            <IChevR size={18} className="chev" />
          </button>
        </div>
        <div className="field">
          <label htmlFor="plan-office">Necesita al mes</label>
          <input id="plan-office" className="input num" inputMode="numeric" value={office} onChange={(e) => setOffice(formatTyping(e.target.value))} placeholder="0" />
        </div>
      </div>
      <button className="btn" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</button>
      <AccountSheet open={pick !== null} currency="COP" onClose={() => setPick(null)} onPick={(a) => { if (pick === "office") setOfficeId(a.id); else setAccId(a.id); setPick(null); }} />
    </div>
  );
}
