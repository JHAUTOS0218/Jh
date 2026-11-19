"use client";

import { useData } from "@/lib/store";
import { money } from "@/lib/format";
import { BackBar } from "@/components/BackBar";
import { RecurringRow, recurringStatus, useRecurringSheets } from "@/components/Recurring";
import { ICalendar, IPlus } from "@/components/Icons";

export default function RecurringPage() {
  const { recurring, allRecurring, recurringPaid, activeId, active, toCOP, accById, needsRecurringUpdate } = useData();
  const { sheets, edit, pay } = useRecurringSheets();

  const scoped = recurring.filter((r) => !activeId || r.business_id === activeId);
  const paused = allRecurring.filter((r) => !r.active && (!activeId || r.business_id === activeId));
  const sorted = [...scoped].sort((a, b) => recurringStatus(a, recurringPaid[a.id]).days - recurringStatus(b, recurringPaid[b.id]).days);
  const pending = sorted.filter((r) => !recurringPaid[r.id]);
  const done = sorted.filter((r) => recurringPaid[r.id]);

  const copOf = (amount: number, accountId: string | null) => toCOP(amount, accById(accountId)?.currency ?? "COP");
  const expenses = scoped.filter((r) => r.kind === "expense");
  const totalMonth = expenses.reduce((s, r) => s + copOf(recurringPaid[r.id]?.amount ?? r.amount, recurringPaid[r.id]?.account_id ?? r.account_id), 0);
  const paidMonth = expenses.filter((r) => recurringPaid[r.id]).reduce((s, r) => s + copOf(recurringPaid[r.id].amount, recurringPaid[r.id].account_id), 0);

  if (needsRecurringUpdate) {
    return (
      <main className="page">
        <BackBar title="Pagos fijos" />
        <div className="empty"><b>Falta activar Pagos fijos</b>Corre el archivo 03-pagos-fijos.sql en Supabase → SQL Editor.</div>
      </main>
    );
  }

  return (
    <main className="page">
      <BackBar title="Pagos fijos" right={<button className="btn small" onClick={() => edit("new")}><IPlus size={18} /> Nuevo</button>} />
      <p className="muted small" style={{ margin: "-6px 2px 12px" }}>
        Arriendo, servicios, suscripciones, plan de datos… Cada mes te recuerdo y con un toque queda registrado{active ? ` · ${active.name}` : ""}.
      </p>

      {scoped.length > 0 && (
        <div className="grid3">
          <div className="kpi"><div className="k">Total del mes</div><div className="v num">{money(totalMonth)}</div></div>
          <div className="kpi income"><div className="k">Ya pagado</div><div className="v num">{money(paidMonth)}</div></div>
          <div className="kpi expense"><div className="k">Falta</div><div className="v num">{money(totalMonth - paidMonth)}</div></div>
        </div>
      )}

      {!scoped.length && (
        <div className="empty">
          <div className="big-ico"><ICalendar size={28} /></div>
          <b>Sin pagos fijos todavía</b>
          Agrega lo que pagas todos los meses para que no se te pase ninguno.
          <div style={{ marginTop: 14 }}><button className="btn small" onClick={() => edit("new")}><IPlus size={16} /> Agregar pago fijo</button></div>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h3 className="h-section">Pendientes este mes</h3>
          <div className="list">{pending.map((r) => <RecurringRow key={r.id} r={r} onOpen={() => edit(r)} onPay={() => pay(r)} />)}</div>
        </>
      )}
      {done.length > 0 && (
        <>
          <h3 className="h-section">Pagados este mes</h3>
          <div className="list">{done.map((r) => <RecurringRow key={r.id} r={r} onOpen={() => edit(r)} onPay={() => pay(r)} />)}</div>
        </>
      )}
      {paused.length > 0 && (
        <>
          <h3 className="h-section">Pausados</h3>
          <div className="list">
            {paused.map((r) => (
              <button key={r.id} className="row link disabled" onClick={() => edit(r)}>
                <div className="main"><div className="t1">{r.name}</div><div className="t2">Día {r.day_of_month}</div></div>
                <div className="amt num">{money(r.amount)}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {sheets}
    </main>
  );
}
