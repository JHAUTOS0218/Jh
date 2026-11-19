import { createClient } from "@supabase/supabase-js";
import { categoryHints, parseBankSms, parseMoney, todayBogota } from "@/lib/parse";

/**
 * Atajos del iPhone (Apple Pay y SMS del banco).
 *
 * GET  /api/atajo?token=…&lista=cuentas | negocios
 *      → texto con una opción por línea, para el menú "Elegir de la lista" del Atajo.
 *
 * POST /api/atajo  JSON: { token, monto?, comercio?, tarjeta?, texto?, fuente?, cuenta?, negocio? }
 *      → si trae cuenta y negocio, queda registrado con la categoría más probable;
 *        si no, queda en "Por clasificar".
 */
export const dynamic = "force-dynamic";

const SKIP = "Después (clasificar en la app)";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().replace(/\s+/g, "");
const client = () => createClient(url, key, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });
const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = (u.searchParams.get("token") ?? req.headers.get("x-jh-token") ?? "").trim();
  const lista = (u.searchParams.get("lista") ?? "").toLowerCase();
  if (!lista) return json({ ok: true, mensaje: "JH Finanzas: usa ?lista=cuentas o ?lista=negocios, o envía un POST." });
  if (!token) return text("Falta el token", 401);
  const { data, error } = await client().rpc("jh_ingest_lists", { p_token: token, p_what: lista.startsWith("neg") ? "negocios" : "cuentas" });
  if (error) return text(/Token inválido/i.test(error.message) ? "Token inválido" : error.message, /Token/i.test(error.message) ? 401 : 500);
  return text([SKIP, ...((data as string[]) ?? [])].join("\n"));
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) body = await req.json();
    else if (ct.includes("form")) body = Object.fromEntries((await req.formData()).entries());
    else {
      const t = await req.text();
      try { body = JSON.parse(t); } catch { body = { texto: t }; }
    }
  } catch {
    return json({ ok: false, error: "No pude leer los datos enviados" }, 400);
  }

  const token = String(body.token ?? req.headers.get("x-jh-token") ?? new URL(req.url).searchParams.get("token") ?? "").trim();
  if (!token) return json({ ok: false, error: "Falta el token" }, 401);

  const texto = String(body.texto ?? body.text ?? "").trim();
  const comercio = String(body.comercio ?? body.merchant ?? "").trim();
  const tarjeta = String(body.tarjeta ?? body.card ?? "").trim();
  const pick = (v: unknown) => { const s = String(v ?? "").trim(); return !s || s.startsWith("Después") ? null : s; };
  const cuenta = pick(body.cuenta);
  const negocio = pick(body.negocio);
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
    raw.unshift(["Apple Pay", comercio && `comercio: ${comercio}`, tarjeta && `tarjeta: ${tarjeta}`, body.monto && `monto: ${body.monto}`].filter(Boolean).join(" · "));
  }
  if (fuente.length > 20) fuente = fuente.slice(0, 20);

  if (!amount || amount <= 0) return json({ ok: false, error: "No encontré el monto" }, 400);
  if (!url || !key) return json({ ok: false, error: "La app no está conectada a la base de datos" }, 500);

  const { data, error } = await client().rpc("jh_ingest_v2", {
    p_token: token,
    p_kind: kind,
    p_amount: amount,
    p_description: description || null,
    p_raw: raw.join("\n"),
    p_source: fuente,
    p_date: date ?? todayBogota(),
    p_account: cuenta,
    p_business: negocio,
    p_category_hints: categoryHints(`${description} ${texto}`),
  });
  if (error) {
    const bad = /Token inválido/i.test(error.message);
    return json({ ok: false, error: bad ? "Token inválido: revisa el token en el Atajo" : error.message }, bad ? 401 : 500);
  }
  const r = (data ?? {}) as { status?: string; cuenta?: string; negocio?: string; categoria?: string };
  const fmt = "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(amount);
  const what = `${kind === "income" ? "Ingreso" : "Gasto"} de ${fmt}${description ? (kind === "income" ? " de " : " en ") + description : ""}`;
  const mensaje =
    r.status === "registrado" ? `✓ ${what} → ${r.negocio}${r.categoria ? " · " + r.categoria : ""} (${r.cuenta})`
    : r.status === "duplicado" ? `✓ ${what} ya estaba registrado`
    : `${what} quedó por clasificar en JH Finanzas`;
  return json({ ok: true, estado: r.status, mensaje });
}
