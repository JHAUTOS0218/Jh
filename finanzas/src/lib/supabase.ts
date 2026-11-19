import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Se limpian espacios, saltos de línea y "/" final que a veces quedan al copiar y pegar en el celular
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().replace(/\s+/g, "");

export const supabaseConfigured = Boolean(url && key);

function jwtRole(k: string): string | null {
  try {
    const part = k.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

/** Revisa que las 2 llaves de Vercel estén bien escritas. Devuelve el problema en español, o null si todo está bien. */
export function configProblem(): string | null {
  if (!url && !key) return "Faltan las dos variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.";
  if (!url) return "Falta la variable NEXT_PUBLIC_SUPABASE_URL (o su nombre está mal escrito).";
  if (!key) return "Falta la variable NEXT_PUBLIC_SUPABASE_ANON_KEY (o su nombre está mal escrito).";
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch {}
  if (!parsed || (parsed.protocol !== "https:" && parsed.hostname !== "localhost"))
    return `El valor de NEXT_PUBLIC_SUPABASE_URL no es una dirección válida. Quedó así: “${url}”. Debe ser exactamente como https://xxxxxxxx.supabase.co`;
  if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role")
    return "En NEXT_PUBLIC_SUPABASE_ANON_KEY pegaste la llave SECRETA. Cámbiala por la llave pública (anon public o Publishable key).";
  if (!key.startsWith("sb_publishable_") && jwtRole(key) !== "anon")
    return `El valor de NEXT_PUBLIC_SUPABASE_ANON_KEY no parece la llave pública de Supabase (empieza por “${key.slice(0, 8)}…”). Debe empezar por eyJ… o por sb_publishable_…`;
  return null;
}

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!client) {
    const p = configProblem();
    if (p) throw new Error(p);
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "jh-finanzas-auth" },
    });
  }
  return client;
}

/** Traduce errores comunes de Supabase a español simple. */
export function errorText(e: unknown): string {
  const msg = (e as { message?: string })?.message || String(e);
  if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(msg)) return "Tu correo aún no está confirmado en Supabase.";
  if (/Invalid API key|No API key/i.test(msg)) return "La llave pública de Supabase no es válida. Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "No se pudo conectar. Revisa tu internet o la dirección NEXT_PUBLIC_SUPABASE_URL en Vercel.";
  if (/foreign key|violates foreign key/i.test(msg)) return "No se puede borrar porque tiene movimientos asociados.";
  return msg;
}
