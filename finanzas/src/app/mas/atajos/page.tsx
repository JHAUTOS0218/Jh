"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useData } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { BackBar } from "@/components/BackBar";
import { toast } from "@/components/ui";

function CopyBox({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); toast("Copiado"); }
    catch { toast("Mantén presionado el texto para copiarlo"); }
  };
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <input className="input num" readOnly value={value} onFocus={(e) => e.target.select()} style={{ fontSize: 14 }} />
        <button className="btn small" onClick={copy}>Copiar</button>
      </div>
    </div>
  );
}

export default function ShortcutsSetup() {
  const { bump } = useData();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState("");

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/atajo`);
    sb().rpc("jh_has_ingest_token").then(({ data, error }) => setHasToken(error ? false : !!data));
  }, []);

  const generate = async () => {
    if (hasToken && !confirm("Si creas un token nuevo, el anterior deja de funcionar y tendrás que cambiarlo en tus Atajos. ¿Continuar?")) return;
    setBusy(true);
    const { data, error } = await sb().rpc("jh_new_ingest_token");
    setBusy(false);
    if (error) return toast(/jh_new_ingest_token/.test(error.message) ? "Falta actualizar la base de datos (08-atajos.sql)" : errorText(error));
    setToken(String(data));
    setHasToken(true);
  };

  const test = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const r = await fetch("/api/atajo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, monto: "$1.000", comercio: "Prueba de conexión", fuente: "prueba" }) });
      const j = await r.json();
      toast(j.ok ? "¡Funciona! Revisa Por clasificar" : j.error || "No funcionó");
      bump();
    } catch {
      toast("No se pudo conectar");
    }
    setBusy(false);
  };

  return (
    <main className="page">
      <BackBar title="Apple Pay y SMS" />
      <p className="muted small" style={{ margin: "-6px 2px 14px" }}>
        Con la app <b>Atajos</b> del iPhone, cada pago con Apple Pay y cada SMS de compra de Bancolombia llega solo a <Link href="/por-clasificar" className="link-btn">Por clasificar</Link>. Tú solo eliges de qué es.
      </p>

      <h3 className="h-section">1 · Tus datos para el Atajo</h3>
      <CopyBox label="Dirección (URL)" value={endpoint} />
      {token ? (
        <>
          <CopyBox label="Tu token secreto (guárdalo, no se vuelve a mostrar)" value={token} />
          <button className="btn secondary" disabled={busy} onClick={test}>Enviar un movimiento de prueba</button>
        </>
      ) : (
        <>
          <p className="muted small">{hasToken ? "Ya tienes un token activo. Si lo perdiste, crea uno nuevo y cámbialo en tus Atajos." : "Crea tu token: es la clave para que solo tus Atajos puedan enviar movimientos."}</p>
          <button className="btn" disabled={busy || hasToken === null} onClick={generate}>{hasToken ? "Crear token nuevo" : "Crear mi token"}</button>
        </>
      )}

      {token && <CopyBox label="Dirección para el menú de bolsillos" value={`${endpoint}?token=${token}&lista=cuentas`} />}

      <h3 className="h-section">2 · Automatización de Apple Pay (un solo menú)</h3>
      <p className="small muted" style={{ margin: "0 2px 8px" }}>
        Al pagar eliges el bolsillo o cuenta (cada uno dice su negocio, ej. “Oficina · JH Autos”). La categoría se pone sola. La app recuerda cada tarjeta y pone su cuenta de primera con ★.
      </p>
      <ol className="small" style={{ paddingLeft: 20, lineHeight: 1.6, margin: 0 }}>
        <li><b>Atajos</b> → <b>Automatización</b> → <b>+</b> → <b>Transacción</b> → tus tarjetas → <b>Ejecutar inmediatamente</b> → <b>Nuevo atajo en blanco</b>.</li>
        <li><b>Obtener contenido de URL</b> → pega la <b>Dirección para el menú de bolsillos</b>.</li>
        <li><b>Dividir texto</b> → <b>Líneas nuevas</b>.</li>
        <li><b>Elegir de la lista</b> → Mensaje: <i>¿De qué bolsillo?</i></li>
        <li><b>Obtener contenido de URL</b> → la <b>Dirección (URL)</b> → <b>›</b> → Método <b>POST</b>, Cuerpo <b>JSON</b>. Campos de tipo <b>Texto</b> (no Número):
          <br />• <b>token</b> → tu token
          <br />• <b>monto</b> → <i>Entrada del atajo</i> → <i>Cantidad</i>
          <br />• <b>comercio</b> → <i>Entrada del atajo</i> → <i>Comerciante</i>
          <br />• <b>tarjeta</b> → <i>Entrada del atajo</i> → <i>Tarjeta o pase</i>
          <br />• <b>cuenta</b> → <i>Elemento seleccionado</i> (del menú)
          <br />• <b>fuente</b> → escribe <b>applepay</b>
        </li>
        <li><b>Obtener valor de diccionario</b> → clave <b>mensaje</b> → <b>Mostrar notificación</b> con ese valor.</li>
      </ol>
      <p className="muted xsmall" style={{ marginTop: 8 }}>
        Si el monto llega en 0 (pasa con algunas tarjetas), la app lo completa sola con el SMS de Bancolombia de esa compra. Por eso conviene tener también la automatización de SMS.
      </p>

      <h3 className="h-section">3 · Automatización de SMS de Bancolombia (sin menú)</h3>
      <ol className="small" style={{ paddingLeft: 20, lineHeight: 1.6, margin: 0 }}>
        <li>En Atajos → <b>Automatización</b> → <b>+</b> → <b>Mensaje</b>.</li>
        <li><b>El mensaje contiene</b>: <b>Bancolombia</b> → <b>Ejecutar inmediatamente</b> → Siguiente.</li>
        <li>Agrega <b>Obtener contenido de URL</b> con la misma Dirección, Método <b>POST</b>, Cuerpo <b>JSON</b>:
          <br />• <b>token</b> → tu token
          <br />• <b>texto</b> → variable <i>Mensaje</i> (el contenido del SMS)
          <br />• <b>fuente</b> → escribe <b>sms</b>
        </li>
      </ol>
      <p className="muted xsmall" style={{ marginTop: 12 }}>
        Si pagas con Apple Pay y también llega el SMS de esa compra, la app los junta en uno solo (mismo valor en 15 minutos).
      </p>
    </main>
  );
}
