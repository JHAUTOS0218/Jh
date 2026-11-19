"use client";

import { useState, type ReactNode } from "react";
import { DataProvider, useData } from "@/lib/store";
import { sb, supabaseConfigured, errorText } from "@/lib/supabase";
import { TabBar } from "./TabBar";
import { TxForm } from "./TxForm";
import { ToastHost } from "./ui";

export function Shell({ children }: { children: ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;
  return (
    <DataProvider>
      <Gate>{children}</Gate>
    </DataProvider>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { session, ready } = useData();
  if (!ready) {
    return (
      <div className="center-screen" style={{ alignItems: "center" }}>
        <div className="brand-mark">JH</div>
        <div className="spinner" />
      </div>
    );
  }
  if (!session) return <Login />;
  return (
    <div className="app">
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
      <div className="brand-mark">JH</div>
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

function NotConfigured() {
  return (
    <div className="center-screen">
      <div className="brand-mark">JH</div>
      <h1 className="title" style={{ fontSize: 18 }}>Falta un paso</h1>
      <p className="muted">
        La app todavía no está conectada a la base de datos. En Vercel, ve a <b>Settings → Environment Variables</b> y agrega
        <b> NEXT_PUBLIC_SUPABASE_URL</b> y <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b>. Luego vuelve a publicar (Redeploy).
      </p>
    </div>
  );
}
