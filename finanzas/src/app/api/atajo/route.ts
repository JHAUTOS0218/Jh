import { createClient } from "@supabase/supabase-js";
import { parseBankSms, parseMoney, todayBogota } from "@/lib/parse";

/**
 * Recibe pagos desde la app Atajos del iPhone (Apple Pay o SMS del banco).
 * POST /api/atajo  con JSON: { token, monto?, comercio?, tarjeta?, texto?, fuente? }
 * Guarda el movimiento en "Por clasificar" (no afecta saldos hasta que lo clasifiques).
 */
export const dynamic = "force-dynamic";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().replace(/\s+/g, "");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

export async function GET() {
  return json({ ok: true, mensaje: "JH Finanzas: envía un POST con token, monto, comercio, tarjeta o texto del SMS." });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) body = await req.json();
    else if (ct.includes("form")) body = Object.fromEntries((await req.formData()).entries());
    else {
      const txt = await req.text();
      try { body = JSON.parse(txt); } catch { body = { texto: txt }; }
    }
  } catch {
    return json({ ok: false, error: "No pude leer los datos enviados" }, 400);
  }

  const token = String(body.token ?? req.headers.get("x-jh-token") ?? new URL(req.url).searchParams.get("token") ?? "").trim();
  if (!token) return json({ ok: false, error: "Falta el token" }, 401);

  const texto = String(body.texto ?? body.text ?? "").trim();
  const comercio = String(body.comercio ?? body.merchant ?? "").trim();
  const tarjeta = String(body.tarjeta ?? body.card ?? "").trim();
  let fuente = String(body.fuente ?? body.source ?? "").trim().toLowerCase() || (texto && !body.monto ? "sms" : "applepay");

  let amount = parseMoney(body.monto ?? body.amount ?? "");
  let kind: "expense" | "income" = String(body.tipo ?? "").toLowerCase().startsWith("ing") ? "income" : "expense";
  let description = comercio;
  let date: string | null = null;
  const raw: string[] = [];

  if (texto) {
    const p = parseBankSms(texto);
    if (!amount) amount = p.amount;
    if (!body.tipo) kind = p.kind;
    if (!description) description = p.merchant;
    date = p.date;
    raw.push(texto);
    if (p.product) raw.push(`Producto: ${p.product}`);
    if (p.usd) raw.push("Moneda: USD");
  }
  if (fuente === "applepay" || comercio || tarjeta) {
    raw.unshift([`Apple Pay`, comercio && `comercio: ${comercio}`, tarjeta && `tarjeta: ${tarjeta}`, body.monto && `monto: ${body.monto}`].filter(Boolean).join(" · "));
  }
  if (fuente.length > 20) fuente = fuente.slice(0, 20);

  if (!amount || amount <= 0) return json({ ok: false, error: "No encontré el monto" }, 400);
  if (!url || !key) return json({ ok: false, error: "La app no está conectada a la base de datos" }, 500);

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await sb.rpc("jh_ingest", {
    p_token: token,
    p_kind: kind,
    p_amount: amount,
    p_description: description || null,
    p_raw: raw.join("\n"),
    p_source: fuente,
    p_date: date ?? todayBogota(),
  });
  if (error) {
    const bad = /Token inválido/i.test(error.message);
    return json({ ok: false, error: bad ? "Token inválido: revisa el token en el Atajo" : error.message }, bad ? 401 : 500);
  }
  const fmt = "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(amount);
  return json({ ok: true, mensaje: `JH Finanzas: ${kind === "income" ? "ingreso" : "gasto"} de ${fmt}${description ? (kind === "income" ? " de " : " en ") + description : ""} quedó por clasificar` });
}
