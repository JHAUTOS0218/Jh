/** Colores de la app que el usuario puede elegir */
export const THEMES: { name: string; color: string }[] = [
  { name: "Esmeralda", color: "#1F9D6B" },
  { name: "Verde petróleo", color: "#1E5B5A" },
  { name: "Verde oliva", color: "#6B7F2E" },
  { name: "Azul noche", color: "#2F5F9E" },
  { name: "Azul acero", color: "#2F7FB0" },
  { name: "Plata", color: "#8A9599" },
  { name: "Vino", color: "#9B2C47" },
  { name: "Dorado", color: "#B08A35" },
  { name: "Café", color: "#8A5A3B" },
  { name: "Morado", color: "#6A4FB3" },
];

export const DEFAULT_THEME = "#1F9D6B";
export type Mode = "dark" | "light";

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mixRgb = ([r, g, b]: number[], [tr, tg, tb]: number[], a: number) =>
  [r + (tr - r) * a, g + (tg - g) * a, b + (tb - b) * a].map((x) => Math.round(x));
const rgbStr = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const luminance = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

export function isValidHex(s: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
}

const KEY = "jh-theme";
const MODE_KEY = "jh-mode";

export function getMode(): Mode {
  try { return localStorage.getItem(MODE_KEY) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

export function setMode(mode: Mode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch {}
  document.documentElement.dataset.mode = mode;
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  applyTheme(saved);
}

export function applyTheme(color: string | null | undefined) {
  const c = color && isValidHex(color) ? color : DEFAULT_THEME;
  const mode = getMode();
  const root = document.documentElement;
  root.dataset.mode = mode;
  const rgb = hexToRgb(c);
  const s = root.style;
  s.setProperty("--petrol", c);
  s.setProperty("--petrol-deep", rgbStr(mixRgb(rgb, [0, 0, 0], 0.38)));
  s.setProperty("--petrol-rgb", rgb.join(", "));
  if (mode === "dark") {
    // sobre fondo oscuro el acento de texto se aclara para que se lea bien
    const lift = luminance(rgb) < 0.45 ? 0.45 : 0.2;
    s.setProperty("--accent", rgbStr(mixRgb(rgb, [255, 255, 255], lift)));
    s.setProperty("--petrol-soft", `rgba(${rgb.join(", ")}, 0.16)`);
  } else {
    s.setProperty("--accent", c);
    s.setProperty("--petrol-soft", rgbStr(mixRgb(rgb, [255, 255, 255], 0.88)));
  }
  try { localStorage.setItem(KEY, c); } catch {}
}

/** Aplica el último color guardado en el teléfono (antes de cargar los datos) */
export function applySavedTheme() {
  try { applyTheme(localStorage.getItem(KEY)); } catch { applyTheme(null); }
}

/** Script que corre antes de pintar la página, para que no parpadee en blanco */
export const PRE_PAINT_SCRIPT = `try{var m=localStorage.getItem('${MODE_KEY}')==='light'?'light':'dark';document.documentElement.dataset.mode=m;}catch(e){document.documentElement.dataset.mode='dark';}`;
