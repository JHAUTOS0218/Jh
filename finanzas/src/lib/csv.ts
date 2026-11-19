import type { Account, Business, Category, Tx } from "./types";

const KIND: Record<string, string> = { expense: "Gasto", income: "Ingreso", transfer: "Transferencia", debt_in: "Entrada por deuda", debt_out: "Salida por deuda" };

function cell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Números con coma decimal para que Excel en español los lea bien */
const num = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export function txsToCSV(
  txs: Tx[],
  look: { biz: (id: string | null) => Business | undefined; acc: (id: string | null) => Account | undefined; cat: (id: string | null) => Category | undefined }
) {
  const head = ["Fecha", "Tipo", "Negocio", "Categoría", "Descripción", "Cuenta", "Banco", "Moneda", "Monto", "Cuenta destino", "Monto recibido", "Tasa dólar", "Monto en pesos", "Nota"];
  const rows = txs.map((t) => {
    const a = look.acc(t.account_id);
    const to = look.acc(t.to_account_id);
    const plus = t.kind === "income" || t.kind === "debt_in";
    const signed = plus ? t.amount : -t.amount;
    return [
      t.date,
      KIND[t.kind] ?? t.kind,
      look.biz(t.business_id)?.name ?? "",
      look.cat(t.category_id)?.name ?? "",
      t.description ?? "",
      a?.name ?? "",
      a?.bank ?? "",
      a?.currency ?? "COP",
      num(t.kind === "transfer" ? -t.amount : signed),
      to?.name ?? "",
      num(t.to_amount),
      num(t.fx_rate),
      num(plus ? t.amount_cop : -t.amount_cop),
      t.note ?? "",
    ];
  });
  // sep=; + BOM hace que Excel abra el archivo con columnas y tildes correctas
  return "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
