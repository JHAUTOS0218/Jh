/** Lee montos escritos de muchas formas: "$45.000,00", "COP 45.000", "45,000.50", "45000" */
export function parseMoney(input: unknown): number {
  if (typeof input === "number") return input;
  const s = String(input ?? "");
  const m = s.match(/\d[\d.,\s]*/);
  if (!m) return 0;
  let t = m[0].replace(/\s/g, "").replace(/[.,]$/, "");
  const lastDot = t.lastIndexOf("."), lastComma = t.lastIndexOf(",");
  let dec = "";
  if (lastDot >= 0 && lastComma >= 0) dec = lastDot > lastComma ? "." : ",";
  else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : "";
    if (sep) {
      const parts = t.split(sep);
      const tail = parts[parts.length - 1];
      if (parts.length === 2 && tail.length <= 2) dec = sep; // 45,5 / 45.50
    }
  }
  if (dec) {
    const thousands = dec === "." ? "," : ".";
    t = t.split(thousands).join("").replace(dec, ".");
  } else {
    t = t.replace(/[.,]/g, "");
  }
  const n = parseFloat(t);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\s+/g, " ").trim().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase()).slice(0, 60);

export interface ParsedSms {
  kind: "expense" | "income";
  amount: number;
  merchant: string;
  product: string | null; // ej. "T.Cred *1234"
  date: string | null;    // yyyy-mm-dd
  usd: boolean;
}

/** Entiende los SMS de Bancolombia (y otros bancos con formato parecido) */
export function parseBankSms(text: string): ParsedSms {
  const t = text.replace(/\s+/g, " ");
  const amountMatch = t.match(/(?:US\$|USD|\$)\s?([\d.,]+)/i);
  const amount = amountMatch ? parseMoney(amountMatch[1]) : parseMoney(t);
  const income = /recibiste|te consignaron|consignaci[oó]n|te transfiri|abono a tu|te enviaron|ingreso/i.test(t) && !/compraste|pagaste|transferiste/i.test(t);
  let merchant = "";
  const pats = income
    ? [/\bde ([^,]+?) (?:en|a) tu/i, /\bde ([^,.]+?)(?:,|\.| el )/i]
    : [/\ben ([^,]+?) con tu/i, /\ba ([^,]+?) desde/i, /\ben ([^,]+?)(?:,| el )/i, /\ba ([^,]+?)(?:,| el )/i];
  for (const p of pats) {
    const m = t.match(p);
    if (m && m[1] && m[1].length < 60) { merchant = titleCase(m[1]); break; }
  }
  if (/transferiste/i.test(t)) {
    const dest = t.match(/\ba la (cuenta|llave)[^\d*]*\*?(\d{3,})/i);
    merchant = dest ? `Transferencia a ${dest[1].toLowerCase()} *${dest[2].slice(-4)}` : "Transferencia";
  }
  if (/retiraste|retiro/i.test(t) && !/transfer/i.test(t)) merchant = "Retiro en cajero";
  const prod = t.match(/(T\.?\s?Cred|T\.?\s?Deb|tarjeta|cuenta|cta|producto)[^*\d]{0,12}\*?(\d{4})/i);
  const d = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  let date: string | null = null;
  if (d) {
    const y = d[3].length === 2 ? `20${d[3]}` : d[3];
    date = `${y}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`;
  }
  return {
    kind: income ? "income" : "expense",
    amount,
    merchant,
    product: prod ? `${prod[1]} *${prod[2]}` : null,
    date,
    usd: /US\$|USD/i.test(t),
  };
}

/** Fecha de hoy en Colombia (yyyy-mm-dd) */
export function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Palabras clave → posibles nombres de categoría (se busca la primera que exista en el negocio elegido) */
const HINTS: [RegExp, string[]][] = [
  [/terpel|primax|texaco|esso|biomax|zeuss|petrobras|gasolin|combustible|eds /i, ["Gasolina", "Moto y carro", "transporte"]],
  [/uber|didi|cabify|indrive|taxi|peaje|parqueadero|parking|transmilenio|metro /i, ["transporte", "Gasolina"]],
  [/exito|éxito|olimpica|olímpica|\bara\b|\bd1\b|jumbo|carulla|pricesmart|makro|isimo|surtimax|mercado|supermercado/i, ["Mercado"]],
  [/rappi|ifood|domicilio|restaurante|crepes|frisby|kfc|mcdonald|burger|pizza|cafe|café|starbucks|juan valdez|panaderia|panadería|corral|subway|wok/i, ["Comida", "Atención a clientes"]],
  [/netflix|spotify|apple\.com|icloud|google|youtube|disney|hbo|max\.com|prime video|amazon prime|chatgpt|openai|claude|anthropic|canva|adobe/i, ["Suscripciones", "Plan de datos"]],
  [/claro|tigo|movistar|\bwom\b|etb|une /i, ["Plan de datos", "Servicios", "Suscripciones"]],
  [/facebook|meta|instagram|fb\.me|ads/i, ["Meta Ads", "Publicidad"]],
  [/drogueria|droguería|farmacia|cruz verde|farmatodo|clinica|clínica|medic|laboratorio|odontolog/i, ["Salud"]],
  [/homecenter|ferreteria|ferretería|easy|constructor/i, ["Oficina", "Equipos", "Mantenimiento", "Alistamiento"]],
  [/zara|falabella|arturo calle|h&m|bershka|pull&bear|studio f|tennis|nike|adidas|ropa/i, ["Ropa"]],
  [/cine|procinal|cinecolombia|cinemark|bar |discoteca|licorera|teatro|concierto|tuboleta/i, ["Salidas"]],
  [/taller|lavadero|repuesto|llanta|montallanta|lubricante|aceite/i, ["Alistamiento", "Mantenimiento", "Moto y carro"]],
  [/runt|transito|tránsito|notaria|notaría|soat|impuesto vehicular|traspaso/i, ["Traspasos", "Trámites", "Moto y carro"]],
  [/epm|electricaribe|afinia|air-e|acueducto|gases|vanti|energia|energía|agua/i, ["Servicios"]],
  [/arriendo|administracion|administración|inmobiliaria/i, ["Vivienda", "Oficina"]],
];

export function categoryHints(text: string): string[] {
  const out: string[] = [];
  for (const [re, names] of HINTS) if (re.test(text)) out.push(...names.filter((n) => !out.includes(n)));
  return out;
}
