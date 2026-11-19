import type { Currency } from "./types";

const intFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const usdFmt = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** $1.250.000  ·  US$1.250,50  ·  -$80.000 */
export function money(n: number | null | undefined, cur: Currency = "COP", opts: { sign?: boolean } = {}) {
  const v = Number(n ?? 0);
  const abs = Math.abs(v);
  const body = cur === "USD" ? "US$" + usdFmt.format(abs) : "$" + intFmt.format(Math.round(abs));
  if (v < 0) return "-" + body;
  if (opts.sign && v > 0) return "+" + body;
  return body;
}

/** Compacto para gráficas: $1,2 M · $850 mil */
export function moneyShort(n: number) {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1_000_000_000) return `${s}$${(a / 1_000_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M`;
  if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000) return `${s}$${Math.round(a / 1_000)} mil`;
  return `${s}$${Math.round(a)}`;
}

/** Convierte lo que escribe el usuario en número. "45.000" → 45000 ; "12,5" (USD) → 12.5 */
export function parseAmount(text: string, cur: Currency = "COP"): number {
  if (!text) return 0;
  if (cur === "COP") {
    const digits = text.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }
  const clean = text.replace(/[^\d,]/g, "");
  const [int, dec] = clean.split(",");
  const n = parseFloat(`${int || "0"}.${(dec || "").slice(0, 2) || "0"}`);
  return isNaN(n) ? 0 : n;
}

/** Formatea mientras se escribe: 1250000 → 1.250.000 */
export function formatTyping(text: string, cur: Currency = "COP"): string {
  if (cur === "COP") {
    const digits = text.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
    return digits ? intFmt.format(parseInt(digits, 10)) : "";
  }
  const clean = text.replace(/\./g, "").replace(/[^\d,]/g, "");
  const parts = clean.split(",");
  const int = parts[0].replace(/^0+(?=\d)/, "");
  const intF = int ? intFmt.format(parseInt(int, 10)) : parts.length > 1 ? "0" : "";
  return parts.length > 1 ? `${intF},${parts.slice(1).join("").slice(0, 2)}` : intF;
}

export function amountToInput(n: number, cur: Currency = "COP"): string {
  if (!n) return "";
  return cur === "USD" ? usdFmt.format(n) : intFmt.format(Math.round(n));
}

// ----------------------------- Fechas -----------------------------
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => isoDate(new Date());

export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Mes como {y, m} con m = 0..11 */
export interface YM { y: number; m: number }
export const currentYM = (): YM => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };
export const addMonths = ({ y, m }: YM, k: number): YM => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; };
export const ymKey = ({ y, m }: YM) => `${y}-${pad(m + 1)}`;
export function monthRange({ y, m }: YM) {
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}` };
}
export const monthLabel = ({ y, m }: YM, withYear = true) =>
  MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1) + (withYear ? ` ${y}` : "");
export const monthShort = ({ m }: YM) => MONTHS_SHORT[m];

export function dayLabel(iso: string) {
  const today = todayISO();
  const y = isoDate(new Date(Date.now() - 86400000));
  if (iso === today) return "Hoy";
  if (iso === y) return "Ayer";
  const d = parseISO(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${DAYS[d.getDay()].charAt(0).toUpperCase() + DAYS[d.getDay()].slice(1)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${sameYear ? "" : " " + d.getFullYear()}`;
}

export function shortDate(iso: string) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
