"use client";

import { useState, type ReactNode } from "react";
import { DataProvider, useData } from "@/lib/store";
import { sb, configProblem, errorText } from "@/lib/supabase";
import { TabBar } from "./TabBar";
import { TxForm } from "./TxForm";
import { ToastHost } from "./ui";
import { BrandMark } from "./BrandMark";

export function Shell({ children }: { children: ReactNode }) {
  const problem = configProblem();
  if (problem) return <NotConfigured problem={problem} />;
  return (
    <DataProvider>
      <Gate>{children}</Gate>
    </DataProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { session, ready, needsDbUpdate, needsRecurringUpdate } = useData();
  if (!ready) {
    return (
      <div className="center-screen" style={{ alignItems: "center" }}>
        <div className="brand-wrap"><BrandMark /></div>
        <div className="spinner" />
      </div>
    );
  }
  if (!session) return <Login />;
  return (
    <div className="app">
      {(needsDbUpdate || needsRecurringUpdate) && <DbUpdateBanner files={[needsDbUpdate && "02-deudas-y-apariencia.sql", needsRecurringUpdate && "03-pagos-fijos.sql"].filter(Boolean) as string[]} />}
      {children}
      <TabBar />
      <TxForm />
      <ToastHost />
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(errorText(error));
  };

  return (
    <form className="center-screen" onSubmit={submit}>
      <div className="brand-wrap"><BrandMark /></div>
      <h1 className="title" style={{ fontSize: 22, marginBottom: 6 }}>JH Finanzas</h1>
      <p className="muted" style={{ margin: "0 0 26px" }}>Tus negocios y tu plata, en un solo lugar.</p>
      <div className="field">
        <label htmlFor="login-email">Correo</label>
        <input id="login-email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="login-pass">Contraseña</label>
        <input id="login-pass" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {err && <div className="alert danger" style={{ marginBottom: 14 }}>{err}</div>}
      <button className="btn" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      <p className="muted xsmall" style={{ textAlign: "center", marginTop: 18 }}>Acceso privado. Solo tu usuario puede ver estos datos.</p>
    </form>
  );
}

function NotConfigured({ problem }: { problem: string }) {
  return (
    <div className="center-screen">
      <div className="brand-wrap"><BrandMark /></div>
      <h1 className="title" style={{ fontSize: 18 }}>Falta un paso</h1>
      <div className="alert danger" style={{ margin: "14px 0" }}><span>{problem}</span></div>
      <p className="muted">
        Corrígelo en Vercel → tu proyecto → <b>Settings → Environments → Production → Environment Variables</b>.
        Luego ve a <b>Deployments</b> → ⋯ → <b>Redeploy</b>.
      </p>
    </div>
  );
}

function DbUpdateBanner({ files }: { files: string[] }) {
  return (
    <div className="alert" style={{ margin: "calc(var(--safe-top) + 8px) 16px 0", borderRadius: 14 }}>
      <span>
        <b>Falta actualizar la base de datos.</b> En Supabase → SQL Editor, pega y corre {files.length > 1 ? "en orden los archivos" : "el archivo"}{" "}
        <b>{files.join(" y ")}</b>.
      </span>
    </div>
  );
}
