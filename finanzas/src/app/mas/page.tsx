"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { formatTyping, money, parseAmount, amountToInput, todayISO } from "@/lib/format";
import { normalizeTx } from "@/lib/store";
import { txsToCSV, downloadText } from "@/lib/csv";
import type { Tx } from "@/lib/types";
import { Sheet, toast } from "@/components/ui";
import {
  IBriefcase, IChevR, IDollar, IDownload, ILogout, IScale, IWallet,
  IHandCoins, ICalendar, IPie, ITarget, ISparkle, IInbox,
} from "@/components/Icons";

export default function More() {
  const { session, settings, bump, bizById, accById, catById } = useData();
  const [rateOpen, setRateOpen] = useState(false);
  const [rateText, setRateText] = useState("");
  const [busy, setBusy] = useState(false);

  const saveRate = async () => {
    const v = parseAmount(rateText);
    if (!v) return;
    const { error } = await sb().from("settings").upsert({ user_id: session!.user.id, usd_rate: v });
    if (error) return toast(errorText(error));
    toast("Tasa del dólar actualizada");
    setRateOpen(false);
    bump();
  };

  const exportAll = async () => {
    setBusy(true);
    const all: Tx[] = [];
    for (let fromRow = 0; ; fromRow += 1000) {
      const { data, error } = await sb().from("transactions").select("*").eq("status", "confirmed")
        .order("date", { ascending: false }).order("created_at", { ascending: false }).range(fromRow, fromRow + 999);
      if (error) { setBusy(false); return toast(errorText(error)); }
      all.push(...(data as Tx[]).map(normalizeTx));
      if (!data || data.length < 1000) break;
    }
    downloadText(`jh-finanzas-respaldo-${todayISO()}.csv`, txsToCSV(all, { biz: bizById, acc: accById, cat: catById }));
    setBusy(false);
    toast(`${all.length} movimientos exportados`);
  };

  const Item = ({ href, icon, label, value, onClick, soon }: { href?: string; icon: React.ReactNode; label: string; value?: string; onClick?: () => void; soon?: string }) => {
    const inner = (
      <>
        <span className="ico">{icon}</span>
        <div className="main"><div className="t1">{label}</div>{soon && <div className="t2">{soon}</div>}</div>
        {value && <span className="muted num small">{value}</span>}
        {!soon && <IChevR size={18} className="chev" />}
      </>
    );
    if (soon) return <div className="row disabled">{inner}</div>;
    if (href) return <Link href={href} className="row link">{inner}</Link>;
    return <button className="row link" onClick={onClick}>{inner}</button>;
  };

  return (
    <main className="page">
      <h1 className="title" style={{ margin: "14px 2px 6px" }}>Más</h1>
      <p className="muted small" style={{ margin: "0 2px" }}>{session?.user.email}</p>

      <h3 className="h-section">Mi plata</h3>
      <div className="list">
        <Item href="/mas/cuentas" icon={<IWallet size={20} />} label="Cuentas y bolsillos" />
        <Item href="/mas/negocios" icon={<IBriefcase size={20} />} label="Negocios y categorías" />
        <Item href="/mas/cuadre" icon={<IScale size={20} />} label="Cuadre por banco" />
        <Item onClick={() => { setRateText(amountToInput(settings.usd_rate)); setRateOpen(true); }} icon={<IDollar size={20} />} label="Tasa del dólar" value={money(settings.usd_rate)} />
      </div>

      <h3 className="h-section">Planeación</h3>
      <div className="list">
        <Item icon={<IHandCoins size={20} />} label="Deudas y préstamos" soon="Llega en la Fase 2" />
        <Item icon={<ICalendar size={20} />} label="Pagos fijos mensuales" soon="Llega en la Fase 2" />
        <Item icon={<IPie size={20} />} label="Presupuestos" soon="Llega en la Fase 2" />
        <Item icon={<ITarget size={20} />} label="Metas de ahorro" soon="Llega en la Fase 2" />
      </div>

      <h3 className="h-section">Inteligencia artificial</h3>
      <div className="list">
        <Item icon={<ISparkle size={20} />} label="Pregúntale a tus finanzas" soon="Llega en la Fase 3" />
        <Item icon={<IInbox size={20} />} label="Por clasificar (Apple Pay y SMS)" soon="Llega en la Fase 3" />
      </div>

      <h3 className="h-section">Datos</h3>
      <div className="list">
        <Item onClick={exportAll} icon={<IDownload size={20} />} label={busy ? "Preparando archivo…" : "Exportar todo a Excel (CSV)"} />
        <Item onClick={async () => { await sb().auth.signOut(); }} icon={<ILogout size={20} />} label="Cerrar sesión" />
      </div>
      <p className="muted xsmall" style={{ textAlign: "center", marginTop: 22 }}>JH Finanzas · versión 1 (Fase 1)</p>

      <Sheet open={rateOpen} onClose={() => setRateOpen(false)} title="Tasa del dólar">
        <p className="muted small" style={{ marginTop: 0 }}>
          Se usa para mostrar tus dólares en pesos en los totales, y como tasa por defecto al registrar movimientos en dólares.
        </p>
        <div className="field">
          <label>Pesos por 1 dólar</label>
          <input className="input num" inputMode="numeric" value={rateText} onChange={(e) => setRateText(formatTyping(e.target.value))} autoFocus />
        </div>
        <button className="btn" onClick={saveRate}>Guardar</button>
      </Sheet>
    </main>
  );
}
