import type { Business, Category, Tx } from "./types";

export interface Summary {
  income: number;
  expense: number;        // todos los egresos (incluye pagos al socio)
  operatingExpense: number; // egresos sin pagos al socio
  partnerPaid: number;    // pagado al socio en el periodo
  profit: number;         // utilidad del negocio (ingresos - egresos operativos)
  partnerShare: number;   // parte que le corresponde al socio
  myProfit: number;       // lo que queda para ti
}

/** Resumen de ingresos/egresos. businessId null = Global (todos). Solo cuenta ingresos y gastos, nunca transferencias. */
export function summarize(txs: Tx[], businessId: string | null, catById: (id: string | null) => Category | undefined, biz?: Business | null): Summary {
  let income = 0, expense = 0, partnerPaid = 0;
  for (const t of txs) {
    if (t.status !== "confirmed" || (t.kind !== "income" && t.kind !== "expense")) continue;
    if (businessId && t.business_id !== businessId) continue;
    if (t.kind === "income") income += t.amount_cop;
    else {
      expense += t.amount_cop;
      if (catById(t.category_id)?.special === "partner_payout") partnerPaid += t.amount_cop;
    }
  }
  const operatingExpense = expense - partnerPaid;
  if (businessId && biz && biz.partner_share > 0) {
    const profit = income - operatingExpense;
    const partnerShare = profit > 0 ? Math.round((profit * biz.partner_share) / 100) : 0;
    return { income, expense, operatingExpense, partnerPaid, profit, partnerShare, myProfit: profit - partnerShare };
  }
  const profit = income - expense;
  return { income, expense, operatingExpense, partnerPaid, profit, partnerShare: 0, myProfit: profit };
}

export interface CatSlice { id: string; name: string; value: number; color: string }

export const PALETTE = ["#1E5B5A", "#6E7B3C", "#2F7F86", "#A88A3D", "#4E6E66", "#8B9A5B", "#3C4F63", "#B0703F", "#7A8D8B", "#5B4E7A", "#9AA3A6", "#2D3B3A"];

export function byCategory(txs: Tx[], kind: "income" | "expense", businessId: string | null, catById: (id: string | null) => Category | undefined): CatSlice[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.status !== "confirmed" || t.kind !== kind) continue;
    if (businessId && t.business_id !== businessId) continue;
    const k = t.category_id ?? "none";
    map.set(k, (map.get(k) ?? 0) + t.amount_cop);
  }
  return [...map.entries()]
    .map(([id, value]) => ({ id, value, name: id === "none" ? "Sin categoría" : catById(id)?.name ?? "Sin categoría", color: "" }))
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
}
