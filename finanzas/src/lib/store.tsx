"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "./supabase";
import { DEFAULT_DEBT_CATEGORIES, type Account, type Asset, type CardInfo, type Business, type Category, type Currency, type Debt, type Recurring, type Settings, type Tx } from "./types";
import { applySavedTheme, applyTheme, DEFAULT_THEME } from "./theme";

interface Data {
  session: Session | null;
  ready: boolean;
  businesses: Business[];        // activos, ordenados
  allBusinesses: Business[];     // incluye archivados
  categories: Category[];
  accounts: Account[];           // activas (incluye tarjetas, para registrar compras)
  allAccounts: Account[];
  /** cuentas con plata (sin tarjetas de crédito) */
  moneyAccounts: Account[];
  /** tarjetas de crédito con su deuda, cupo y disponible */
  cards: CardInfo[];
  balances: Record<string, number>;
  settings: Settings;
  /** deudas activas con lo pagado y lo que falta */
  debts: Debt[];
  allDebts: Debt[];
  /** true si falta correr la actualización 02 en Supabase */
  needsDbUpdate: boolean;
  /** movimientos que llegaron de Apple Pay / SMS y faltan por clasificar */
  pendingCount: number;
  /** activos (carros, motos, oro…) */
  assets: Asset[];
  allAssets: Asset[];
  /** pagos fijos activos y los pagos hechos este mes (id del pago fijo → movimiento) */
  recurring: Recurring[];
  allRecurring: Recurring[];
  recurringPaid: Record<string, Tx>;
  needsRecurringUpdate: boolean;
  /** Negocio activo ("espacio"). null = Global */
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  active: Business | null;
  version: number;
  refresh: () => Promise<void>;
  bump: () => void;
  toCOP: (amount: number, cur: Currency) => number;
  bizById: (id: string | null | undefined) => Business | undefined;
  accById: (id: string | null | undefined) => Account | undefined;
  catById: (id: string | null | undefined) => Category | undefined;
  /** Abre el formulario de movimiento (nuevo o edición) */
  openTx: (tx?: Partial<Tx> | null) => void;
  txDraft: Partial<Tx> | null | undefined;
  closeTx: () => void;
}

const Ctx = createContext<Data | null>(null);

export const useData = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData fuera de DataProvider");
  return c;
};

const ACTIVE_KEY = "jh-active-business";

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [allBusinesses, setBiz] = useState<Business[]>([]);
  const [categories, setCats] = useState<Category[]>([]);
  const [allAccounts, setAccs] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Settings>({ usd_rate: 4000, display_name: null, theme_color: DEFAULT_THEME, debt_categories: DEFAULT_DEBT_CATEGORIES });
  const [allDebts, setDebts] = useState<Debt[]>([]);
  const [needsDbUpdate, setNeedsDbUpdate] = useState(false);
  const [allRecurring, setRecurring] = useState<Recurring[]>([]);
  const [allAssets, setAssets] = useState<Asset[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [recurringPaid, setRecurringPaid] = useState<Record<string, Tx>>({});
  const [needsRecurringUpdate, setNeedsRecurringUpdate] = useState(false);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [txDraft, setTxDraft] = useState<Partial<Tx> | null | undefined>(undefined);

  // --- sesión ---
  useEffect(() => {
    applySavedTheme();
    const client = sb();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => setSession(s));
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      if (saved) setActiveIdState(saved === "global" ? null : saved);
    } catch {}
    return () => sub.subscription.unsubscribe();
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    try { localStorage.setItem(ACTIVE_KEY, id ?? "global"); } catch {}
  }, []);

  const refresh = useCallback(async () => {
    const c = sb();
    const now = new Date();
    const mFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const [b, cat, a, bal, st, dbt, dbal, rec, recTx, ast] = await Promise.all([
      c.from("businesses").select("*").order("sort").order("created_at"),
      c.from("categories").select("*").order("sort").order("created_at"),
      c.from("accounts").select("*").order("sort").order("created_at"),
      c.from("account_balances").select("*"),
      c.from("settings").select("*").maybeSingle(),
      c.from("debts").select("*").order("created_at"),
      c.from("debt_balances").select("*"),
      c.from("recurring_payments").select("*").order("day_of_month").order("sort"),
      c.from("transactions").select("*").not("recurring_id", "is", null).gte("date", mFrom).order("date", { ascending: false }),
      c.from("assets").select("*").order("sort").order("created_at"),
    ]);
    const pend = await c.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending");
    setPendingCount(pend.count ?? 0);
    if (!ast.error) {
      setAssets((ast.data as Asset[]).map((x) => ({
        ...x,
        cost: Number(x.cost),
        sale_price: x.sale_price == null ? null : Number(x.sale_price),
        partner_amount: x.partner_amount == null ? null : Number(x.partner_amount),
        sold_price: x.sold_price == null ? null : Number(x.sold_price),
      })));
    }
    const err = b.error || cat.error || a.error || bal.error || st.error;
    if (err) throw err;
    const num = <T,>(rows: T[], keys: (keyof T)[]) =>
      rows.map((r) => { const o = { ...r }; keys.forEach((k) => { if (o[k] != null) (o[k] as unknown) = Number(o[k]); }); return o; });
    setBiz(num(b.data as Business[], ["partner_share"]));
    setCats(cat.data as Category[]);
    setAccs(num(a.data as Account[], ["initial_balance", "min_balance", "credit_limit", "overlimit_pct", "card_fx_rate"]));
    const map: Record<string, number> = {};
    (bal.data as { account_id: string; balance: number }[]).forEach((r) => (map[r.account_id] = Number(r.balance)));
    setBalances(map);
    if (st.data) {
      const next: Settings = {
        usd_rate: Number(st.data.usd_rate),
        display_name: st.data.display_name,
        theme_color: st.data.theme_color || DEFAULT_THEME,
        debt_categories: st.data.debt_categories?.length ? st.data.debt_categories : DEFAULT_DEBT_CATEGORIES,
      };
      setSettings(next);
      applyTheme(next.theme_color);
    }
    // Pagos fijos (actualización 03)
    if (rec.error || recTx.error) {
      setNeedsRecurringUpdate(true);
      setRecurring([]);
      setRecurringPaid({});
    } else {
      setNeedsRecurringUpdate(false);
      setRecurring((rec.data as Recurring[]).map((r) => ({ ...r, amount: Number(r.amount) })));
      const paid: Record<string, Tx> = {};
      (recTx.data as Tx[]).map(normalizeTx).forEach((t) => { if (t.recurring_id && !paid[t.recurring_id]) paid[t.recurring_id] = t; });
      setRecurringPaid(paid);
    }
    // Deudas (si la actualización 02 no se ha corrido, la app sigue funcionando sin esta parte)
    if (dbt.error || dbal.error) {
      setNeedsDbUpdate(true);
      setDebts([]);
    } else {
      setNeedsDbUpdate(false);
      const paid = new Map((dbal.data as { debt_id: string; paid: number }[]).map((r) => [r.debt_id, Number(r.paid)]));
      setDebts(
        (dbt.data as Debt[]).map((d) => {
          const total = Number(d.total_amount);
          const p = paid.get(d.id) ?? 0;
          return { ...d, total_amount: total, installment: d.installment == null ? null : Number(d.installment), paid: p, remaining: Math.max(0, Math.round((total - p) * 100) / 100) };
        })
      );
    }
  }, []);

  // --- carga inicial (y crea negocios por defecto la primera vez) ---
  useEffect(() => {
    if (!session) { setLoaded(false); return; }
    let cancel = false;
    (async () => {
      try {
        const { count } = await sb().from("businesses").select("id", { count: "exact", head: true });
        if (!count) await sb().rpc("jh_seed");
        await refresh();
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancel) setLoaded(true);
      }
    })();
    return () => { cancel = true; };
  }, [session, refresh]);

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    refresh().catch(console.error);
  }, [refresh]);

  const businesses = useMemo(() => allBusinesses.filter((b) => !b.archived), [allBusinesses]);
  const accounts = useMemo(() => allAccounts.filter((a) => !a.archived), [allAccounts]);
  const debts = useMemo(() => allDebts.filter((d) => !d.archived), [allDebts]);
  const recurring = useMemo(() => allRecurring.filter((r) => r.active), [allRecurring]);
  const assets = useMemo(() => allAssets.filter((x) => x.status === "active"), [allAssets]);
  const moneyAccounts = useMemo(() => accounts.filter((a) => a.type !== "card"), [accounts]);
  const cards = useMemo<CardInfo[]>(() => {
    return accounts
      .filter((a) => a.type === "card" && !a.parent_id)
      .map((card) => {
        const usd = accounts.find((x) => x.parent_id === card.id);
        const debtCOP = Math.max(0, -(balances[card.id] ?? 0));
        const debtUSD = usd ? Math.max(0, -(balances[usd.id] ?? 0)) : 0;
        const rate = card.card_fx_rate || settings.usd_rate;
        const totalDebt = Math.round(debtCOP + debtUSD * rate);
        const limit = card.credit_limit ?? 0;
        const overlimit = Math.round((limit * (card.overlimit_pct ?? 0)) / 100);
        return { card, usd, debtCOP, debtUSD, rate, totalDebt, limit, overlimit, available: limit - totalDebt };
      });
  }, [accounts, balances, settings.usd_rate]);

  // si el negocio activo ya no existe, volver a Global
  useEffect(() => {
    if (loaded && activeId && !businesses.find((b) => b.id === activeId)) setActiveId(null);
  }, [loaded, activeId, businesses, setActiveId]);

  const value = useMemo<Data>(() => {
    const bMap = new Map(allBusinesses.map((b) => [b.id, b]));
    const aMap = new Map(allAccounts.map((a) => [a.id, a]));
    const cMap = new Map(categories.map((c) => [c.id, c]));
    return {
      session,
      ready: authChecked && (!session || loaded),
      businesses,
      allBusinesses,
      categories,
      accounts,
      allAccounts,
      moneyAccounts,
      cards,
      balances,
      settings,
      debts,
      allDebts,
      needsDbUpdate,
      assets,
      allAssets,
      pendingCount,
      recurring,
      allRecurring,
      recurringPaid,
      needsRecurringUpdate,
      activeId,
      setActiveId,
      active: activeId ? bMap.get(activeId) ?? null : null,
      version,
      refresh,
      bump,
      toCOP: (amount, cur) => (cur === "USD" ? Math.round(amount * settings.usd_rate) : amount),
      bizById: (id) => (id ? bMap.get(id) : undefined),
      accById: (id) => (id ? aMap.get(id) : undefined),
      catById: (id) => (id ? cMap.get(id) : undefined),
      openTx: (tx) => setTxDraft(tx ?? null),
      txDraft,
      closeTx: () => setTxDraft(undefined),
    };
  }, [session, authChecked, loaded, businesses, allBusinesses, categories, accounts, allAccounts, moneyAccounts, cards, balances, settings, debts, allDebts, needsDbUpdate, assets, allAssets, pendingCount, recurring, allRecurring, recurringPaid, needsRecurringUpdate, activeId, setActiveId, version, refresh, bump, txDraft]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ------------------------------------------------------------------
//  Consulta de movimientos
// ------------------------------------------------------------------
export interface TxQuery {
  from?: string;
  to?: string;
  businessId?: string | null; // incluye movimientos del negocio y de sus cuentas
  limit?: number;
  status?: "confirmed" | "pending";
}

export function normalizeTx(r: Tx): Tx {
  return {
    ...r,
    amount: Number(r.amount),
    amount_cop: Number(r.amount_cop),
    to_amount: r.to_amount == null ? null : Number(r.to_amount),
    debt_id: r.debt_id ?? null,
    debt_role: r.debt_role ?? null,
    recurring_id: r.recurring_id ?? null,
    fx_rate: r.fx_rate == null ? null : Number(r.fx_rate),
  };
}

export function useTxs(q: TxQuery) {
  const { version, accounts, session } = useData();
  const [data, setData] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bizAccIds = useMemo(
    () => (q.businessId ? accounts.filter((a) => a.business_id === q.businessId).map((a) => a.id) : []),
    [accounts, q.businessId]
  );
  const key = JSON.stringify([q, bizAccIds, version]);

  useEffect(() => {
    if (!session) return;
    let cancel = false;
    setLoading(true);
    let query = sb().from("transactions").select("*").eq("status", q.status ?? "confirmed");
    if (q.from) query = query.gte("date", q.from);
    if (q.to) query = query.lte("date", q.to);
    if (q.businessId) {
      const parts = [`business_id.eq.${q.businessId}`];
      if (bizAccIds.length) {
        parts.push(`account_id.in.(${bizAccIds.join(",")})`, `to_account_id.in.(${bizAccIds.join(",")})`);
      }
      query = query.or(parts.join(","));
    }
    query = query.order("date", { ascending: false }).order("created_at", { ascending: false }).limit(q.limit ?? 2000);
    query.then(({ data, error }) => {
      if (cancel) return;
      if (error) setError(error.message);
      else { setError(null); setData((data as Tx[]).map(normalizeTx)); }
      setLoading(false);
    });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, session]);

  return { data, loading, error };
}
