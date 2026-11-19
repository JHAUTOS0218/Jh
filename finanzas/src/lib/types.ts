export type Currency = "COP" | "USD";
export type TxKind = "expense" | "income" | "transfer" | "debt_in" | "debt_out";
export type CatKind = "income" | "expense";
export type AccountType = "bank" | "pocket" | "cash" | "card" | "other";

export interface Business {
  id: string;
  name: string;
  color: string;
  partner_name: string | null;
  partner_share: number;
  sort: number;
  archived: boolean;
}

export interface Category {
  id: string;
  business_id: string;
  kind: CatKind;
  name: string;
  special: string | null;
  sort: number;
  archived: boolean;
}

export interface Account {
  id: string;
  business_id: string;
  name: string;
  type: AccountType;
  bank: string | null;
  currency: Currency;
  initial_balance: number;
  min_balance: number | null;
  sort: number;
  archived: boolean;
  // Tarjetas de crédito
  credit_limit?: number | null;
  overlimit_pct?: number | null;
  cut_day?: number | null;
  pay_day?: number | null;
  card_fx_rate?: number | null;
  /** si existe, esta cuenta es la parte en dólares de la tarjeta parent_id */
  parent_id?: string | null;
}

/** Tarjeta de crédito con su deuda en pesos y (opcional) en dólares */
export interface CardInfo {
  card: Account;
  usd?: Account;
  debtCOP: number;        // deuda en pesos (positivo)
  debtUSD: number;        // deuda en dólares (positivo)
  rate: number;           // tasa usada para la parte en dólares
  totalDebt: number;      // deuda total en pesos
  limit: number;          // cupo
  overlimit: number;      // sobrecupo en pesos
  available: number;      // cupo - deuda (sin sobrecupo)
}

export interface Tx {
  id: string;
  kind: TxKind;
  date: string; // yyyy-mm-dd
  amount: number;
  account_id: string | null;
  to_account_id: string | null;
  to_amount: number | null;
  business_id: string | null;
  category_id: string | null;
  description: string | null;
  note: string | null;
  fx_rate: number | null;
  amount_cop: number;
  status: "confirmed" | "pending";
  source: string;
  created_at: string;
  debt_id?: string | null;
  debt_role?: "disbursement" | "payment" | null;
  recurring_id?: string | null;
}

export interface Recurring {
  id: string;
  name: string;
  kind: CatKind;
  amount: number;
  business_id: string;
  category_id: string | null;
  account_id: string | null;
  day_of_month: number;
  note: string | null;
  active: boolean;
  sort: number;
}

export type DebtDirection = "owe" | "owed"; // owe = yo debo · owed = me deben

export interface Debt {
  id: string;
  direction: DebtDirection;
  person: string;
  description: string | null;
  category: string | null;
  business_id: string;
  currency: Currency;
  total_amount: number;
  installment: number | null;
  due_day: number | null;
  start_date: string;
  note: string | null;
  archived: boolean;
  /** se guarda pero no suma en los totales (deuda inviable / aparte) */
  excluded?: boolean;
  created_at: string;
  /** calculados en la app */
  paid: number;
  remaining: number;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  business_id: string;
  cost: number;
  sale_price: number | null;
  partner_name: string | null;
  partner_amount: number | null;
  detail: string | null;
  note: string | null;
  acquired_date: string | null;
  status: "active" | "sold";
  sold_price: number | null;
  sold_date: string | null;
  sort: number;
}

export const ASSET_CATEGORIES = ["Vehículo", "Moto", "Oro y joyas", "Inventario", "Inmueble", "Otro"];

export interface Settings {
  usd_rate: number;
  display_name: string | null;
  theme_color: string;
  debt_categories: string[];
}

export const DEFAULT_DEBT_CATEGORIES = ["Préstamo", "Venta a crédito", "Proveedor", "Tarjeta o crédito bancario", "Arriendo", "Otro"];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Banco" },
  { value: "pocket", label: "Bolsillo" },
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
];

export const accountTypeLabel = (t: AccountType) =>
  ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;
