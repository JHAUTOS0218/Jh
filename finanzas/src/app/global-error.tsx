"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-CO">
      <body style={{ fontFamily: "-apple-system, sans-serif", padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20 }}>Algo salió mal</h1>
        <p style={{ background: "#f8e9e6", color: "#7c2a20", padding: 14, borderRadius: 12, wordBreak: "break-word" }}>{error.message || "Error desconocido"}</p>
        <p style={{ color: "#666" }}>Toma una captura de esta pantalla y envíala para revisarlo.</p>
        <button onClick={reset} style={{ padding: "12px 18px", borderRadius: 12, border: 0, background: "#1e5b5a", color: "#fff", fontWeight: 700 }}>Intentar de nuevo</button>
      </body>
    </html>
  );
}
