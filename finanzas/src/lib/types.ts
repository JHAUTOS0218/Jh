export type Currency = "COP" | "USD";
export type TxKind = "expense" | "income" | "transfer";
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
}

export interface Settings {
  usd_rate: number;
  display_name: string | null;
}

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Banco" },
  { value: "pocket", label: "Bolsillo" },
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
];

export const accountTypeLabel = (t: AccountType) =>
  ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;
