"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useData, normalizeTx } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { formatTyping, money, parseAmount, amountToInput, todayISO } from "@/lib/format";
import { txsToCSV, downloadText } from "@/lib/csv";
import { THEMES, applyTheme, isValidHex, getMode, setMode, type Mode } from "@/lib/theme";
import type { Tx } from "@/lib/types";
import { Seg, Sheet, toast } from "@/components/ui";
import { BackBar } from "@/components/BackBar";
import { BrandMark } from "@/components/BrandMark";
import { DebtCategoriesEditor } from "@/components/Debts";
import {
  IBriefcase, IChevR, IDollar, IDownload, ILogout, IScale, IWallet, IEdit,
  IHandCoins, ICalendar, IPie, ITarget, ISparkle, IInbox, ITag,
} from "@/components/Icons";

type Panel = null | "rate" | "name" | "theme" | "debtcats";

export default function More() {
  const { session, settings, bump, bizById, accById, catById, needsDbUpdate } = useData();
  const [panel, setPanel] = useState<Panel>(null);
  const [rateText, setRateText] = useState("");
  const [nameText, setNameText] = useState("");
  const [busy, setBusy] = useState(false);

  const saveSettings = async (patch: Record<string, unknown>, msg: string) => {
    const { error } = await sb().from("settings").upsert({ user_id: session!.user.id, ...patch });
    if (error) { toast(errorText(error)); return false; }
    toast(msg);
    bump();
    return true;
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

  const Item = ({ href, icon, label, value, onClick, soon }: { href?: string; icon: ReactNode; label: string; value?: ReactNode; onClick?: () => void; soon?: string }) => {
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
      <BackBar title="Más" fallback="/" />
      <div className="card soft" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <BrandMark size={58} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{settings.display_name || "Tu nombre"}</div>
          <div className="muted small" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{session?.user.email}</div>
        </div>
        <button className="icon-btn" onClick={() => { setNameText(settings.display_name ?? ""); setPanel("name"); }} aria-label="Editar nombre"><IEdit size={18} /></button>
      </div>

      <h3 className="h-section">Personalizar</h3>
      <div className="list">
        <Item onClick={() => setPanel("theme")} icon={<span style={{ width: 20, height: 20, borderRadius: 10, background: "var(--petrol)", display: "block" }} />} label="Apariencia (modo y color)" value={THEMES.find((t) => t.color.toLowerCase() === settings.theme_color.toLowerCase())?.name ?? "Personalizado"} />
        <Item onClick={() => { setNameText(settings.display_name ?? ""); setPanel("name"); }} icon={<IEdit size={20} />} label="Tu nombre" value={settings.display_name || "—"} />
      </div>

      <h3 className="h-section">Mi plata</h3>
      <div className="list">
        <Item href="/mas/cuentas" icon={<IWallet size={20} />} label="Cuentas y bolsillos" />
        <Item href="/mas/negocios" icon={<IBriefcase size={20} />} label="Negocios y categorías" />
        <Item href="/deudas" icon={<IHandCoins size={20} />} label="Deudas y cuentas por cobrar" />
        <Item href="/activos" icon={<ITarget size={20} />} label="Activos (carros, motos, oro)" />
        <Item onClick={() => setPanel("debtcats")} icon={<ITag size={20} />} label="Categorías de deudas" />
        <Item href="/mas/cuadre" icon={<IScale size={20} />} label="Cuadre por banco" />
        <Item onClick={() => { setRateText(amountToInput(settings.usd_rate)); setPanel("rate"); }} icon={<IDollar size={20} />} label="Tasa del dólar" value={money(settings.usd_rate)} />
      </div>

      <h3 className="h-section">Planeación</h3>
      <div className="list">
        <Item href="/mas/pagos-fijos" icon={<ICalendar size={20} />} label="Pagos fijos mensuales" />
        <Item href="/mas/presupuestos" icon={<IPie size={20} />} label="Presupuestos" />
        <Item href="/mi-mes" icon={<ICalendar size={20} />} label="Mi mes (cuánto cuesta mi vida)" />
        <Item href="/plan" icon={<ITarget size={20} />} label="Plan de la plata (recomendaciones)" />
        <Item icon={<ITarget size={20} />} label="Metas de ahorro" soon="Llega en la Fase 2" />
      </div>

      <h3 className="h-section">Inteligencia artificial</h3>
      <div className="list">
        <Item icon={<ISparkle size={20} />} label="Pregúntale a tus finanzas" soon="Llega en la Fase 3" />
        <Item href="/por-clasificar" icon={<IInbox size={20} />} label="Por clasificar (Apple Pay y SMS)" />
        <Item href="/mas/atajos" icon={<IInbox size={20} />} label="Conectar Apple Pay y SMS (Atajos)" />
      </div>

      <h3 className="h-section">Datos</h3>
      <div className="list">
        <Item onClick={exportAll} icon={<IDownload size={20} />} label={busy ? "Preparando archivo…" : "Exportar todo a Excel (CSV)"} />
        <Item onClick={async () => { await sb().auth.signOut(); }} icon={<ILogout size={20} />} label="Cerrar sesión" />
      </div>
      <p className="muted xsmall" style={{ textAlign: "center", marginTop: 22 }}>JH Finanzas · versión 1.1</p>

      {/* ---- Tasa del dólar ---- */}
      <Sheet open={panel === "rate"} onClose={() => setPanel(null)} title="Tasa del dólar">
        <p className="muted small" style={{ marginTop: 0 }}>Se usa para mostrar tus dólares en pesos y como tasa por defecto al registrar movimientos en dólares.</p>
        <div className="field">
          <label htmlFor="rate">Pesos por 1 dólar</label>
          <input id="rate" className="input num" inputMode="numeric" value={rateText} onChange={(e) => setRateText(formatTyping(e.target.value))} autoFocus />
        </div>
        <button className="btn" onClick={async () => { const v = parseAmount(rateText); if (v && (await saveSettings({ usd_rate: v }, "Tasa del dólar actualizada"))) setPanel(null); }}>Guardar</button>
      </Sheet>

      {/* ---- Nombre ---- */}
      <Sheet open={panel === "name"} onClose={() => setPanel(null)} title="Tu nombre">
        <div className="field">
          <label htmlFor="name">¿Cómo te saludo?</label>
          <input id="name" className="input" value={nameText} onChange={(e) => setNameText(e.target.value)} placeholder="Julián" autoFocus />
        </div>
        <button className="btn" onClick={async () => { if (await saveSettings({ display_name: nameText.trim() || null }, "Nombre guardado")) setPanel(null); }}>Guardar</button>
      </Sheet>

      {/* ---- Colores ---- */}
      <Sheet open={panel === "theme"} onClose={() => setPanel(null)} title="Color de la app">
        {needsDbUpdate && <div className="alert" style={{ marginBottom: 12 }}>Para guardar el color, corre primero la actualización 02 en Supabase.</div>}
        <ThemePicker current={settings.theme_color} onPick={async (c) => { applyTheme(c); await saveSettings({ theme_color: c }, "Color actualizado"); }} />
      </Sheet>

      {/* ---- Categorías de deudas ---- */}
      <Sheet open={panel === "debtcats"} onClose={() => setPanel(null)} title="Categorías de deudas">
        <DebtCategoriesEditor />
      </Sheet>
    </main>
  );
}

function ThemePicker({ current, onPick }: { current: string; onPick: (c: string) => void }) {
  const [custom, setCustom] = useState(current);
  const [mode, setModeState] = useState<Mode>("dark");
  useEffect(() => setModeState(getMode()), []);
  return (
    <div>
      <span className="lbl">Modo</span>
      <Seg value={mode} onChange={(m) => { setModeState(m); setMode(m); }} options={[{ value: "dark", label: "Oscuro" }, { value: "light", label: "Claro" }]} />
      <h3 className="h-section">Color de acento</h3>
      <p className="muted small" style={{ marginTop: 0 }}>Cambia el color principal: botones, tarjeta de Inicio, pestañas y gráficas. Se ve al instante.</p>
      <div className="color-grid">
        {THEMES.map((t) => (
          <button key={t.color} className={"color-opt" + (current.toLowerCase() === t.color.toLowerCase() ? " on" : "")} onClick={() => onPick(t.color)}>
            <span className="sw" style={{ background: t.color }} />
            {t.name}
          </button>
        ))}
      </div>
      <h3 className="h-section">Color personalizado</h3>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="color" value={isValidHex(custom) ? custom : "#1E5B5A"} onChange={(e) => setCustom(e.target.value)} style={{ width: 52, height: 48, border: 0, background: "none", padding: 0 }} aria-label="Elegir color" />
        <input className="input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="#1E5B5A" />
        <button className="btn small" disabled={!isValidHex(custom)} onClick={() => onPick(custom)}>Usar</button>
      </div>
      <div className="hero" style={{ marginTop: 18, padding: 16 }}>
        <div className="label">Vista previa</div>
        <div className="big num" style={{ fontSize: 24 }}>$12.450.000</div>
      </div>
    </div>
  );
}
