/** Colores de la app que el usuario puede elegir */
export const THEMES: { name: string; color: string }[] = [
  { name: "Verde petróleo", color: "#1E5B5A" },
  { name: "Verde dinero", color: "#1F7A4D" },
  { name: "Verde oliva", color: "#5F6F2E" },
  { name: "Azul noche", color: "#1F3A5F" },
  { name: "Azul acero", color: "#2F6690" },
  { name: "Grafito", color: "#2B2F33" },
  { name: "Vino", color: "#7A1F35" },
  { name: "Dorado", color: "#9A7B2F" },
  { name: "Café", color: "#6B4A33" },
  { name: "Morado", color: "#4B3B7A" },
];

export const DEFAULT_THEME = "#1E5B5A";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex: string, target: number, amount: number) {
  const [r, g, b] = hexToRgb(hex);
  const m = (c: number) => Math.round(c + (target - c) * amount);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

export function isValidHex(s: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
}

const KEY = "jh-theme";

export function applyTheme(color: string | null | undefined) {
  const c = color && isValidHex(color) ? color : DEFAULT_THEME;
  const root = document.documentElement.style;
  const [r, g, b] = hexToRgb(c);
  root.setProperty("--petrol", c);
  root.setProperty("--petrol-deep", mix(c, 0, 0.38));
  root.setProperty("--petrol-soft", mix(c, 255, 0.88));
  root.setProperty("--petrol-rgb", `${r}, ${g}, ${b}`);
  try { localStorage.setItem(KEY, c); } catch {}
}

/** Aplica el último color guardado en el teléfono (antes de cargar los datos) */
export function applySavedTheme() {
  try { applyTheme(localStorage.getItem(KEY)); } catch { applyTheme(null); }
}
