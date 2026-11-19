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

      {token && (
        <>
          <CopyBox label="Dirección para el menú de cuentas" value={`${endpoint}?token=${token}&lista=cuentas`} />
          <CopyBox label="Dirección para el menú de negocios" value={`${endpoint}?token=${token}&lista=negocios`} />
        </>
      )}

      <h3 className="h-section">2 · Automatización de Apple Pay (con menú)</h3>
      <p className="small muted" style={{ margin: "0 2px 8px" }}>Al pagar te pregunta la cuenta o bolsillo y el negocio. La categoría se pone sola y te llega una notificación con el resultado.</p>
      <ol className="small" style={{ paddingLeft: 20, lineHeight: 1.6, margin: 0 }}>
        <li>Abre <b>Atajos</b> → <b>Automatización</b> → <b>+</b> → <b>Transacción</b>. Marca tus tarjetas → <b>Ejecutar inmediatamente</b> → <b>Siguiente</b> → <b>Nuevo atajo en blanco</b>.</li>
        <li>Acción <b>Obtener contenido de URL</b> → pega la <b>Dirección para el menú de cuentas</b>.</li>
        <li>Acción <b>Dividir texto</b> → separador: <b>Saltos de línea</b>.</li>
        <li>Acción <b>Elegir de la lista</b> → texto: <i>¿De qué cuenta o bolsillo?</i></li>
        <li>Acción <b>Obtener contenido de URL</b> → pega la <b>Dirección para el menú de negocios</b>.</li>
        <li>Acción <b>Dividir texto</b> → <b>Saltos de línea</b>.</li>
        <li>Acción <b>Elegir de la lista</b> → texto: <i>¿De qué negocio?</i></li>
        <li>Acción <b>Obtener contenido de URL</b> → pega la <b>Dirección (URL)</b> de arriba → toca <b>›</b>: Método <b>POST</b>, Cuerpo <b>JSON</b>, con estos campos de tipo Texto:
          <br />• <b>token</b> → tu token
          <br />• <b>monto</b> → variable <i>Importe</i>
          <br />• <b>comercio</b> → variable <i>Comercio</i>
          <br />• <b>tarjeta</b> → variable <i>Tarjeta</i>
          <br />• <b>cuenta</b> → el <i>Elemento elegido</i> del primer menú
          <br />• <b>negocio</b> → el <i>Elemento elegido</i> del segundo menú
          <br />• <b>fuente</b> → escribe <b>applepay</b>
        </li>
        <li>Acción <b>Obtener valor de diccionario</b> → clave <b>mensaje</b>.</li>
        <li>Acción <b>Mostrar notificación</b> → el <i>Valor de diccionario</i>.</li>
      </ol>
      <p className="muted xsmall" style={{ marginTop: 8 }}>Si vas de afán, elige “Después” en los menús y queda en Por clasificar.</p>

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
