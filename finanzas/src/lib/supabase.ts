import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!client) {
    if (!url || !key) throw new Error("Falta configurar Supabase");
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
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  if (/foreign key|violates foreign key/i.test(msg)) return "No se puede borrar porque tiene movimientos asociados.";
  return msg;
}
