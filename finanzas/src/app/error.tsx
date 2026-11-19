"use client";

/** Si algo falla, mostrar el error en español en vez de una pantalla en blanco */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="center-screen">
      <h1 className="title" style={{ fontSize: 18 }}>Algo salió mal</h1>
      <div className="alert danger" style={{ margin: "14px 0", wordBreak: "break-word" }}><span>{error.message || "Error desconocido"}</span></div>
      <p className="muted small">Toma una captura de esta pantalla y envíala para revisarlo.</p>
      <button className="btn" style={{ marginTop: 14 }} onClick={reset}>Intentar de nuevo</button>
    </div>
  );
}
