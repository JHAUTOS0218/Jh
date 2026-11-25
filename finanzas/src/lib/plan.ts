import type { Account, Budget, Business, CardInfo, Category, Currency, Debt, PlanSettings, Recurring, Tx } from "./types";
import { summarize } from "./stats";

export interface CostLine { key: string; label: string; detail?: string; amount: number; note?: string }
export interface MonthlyCost {
  fixed: CostLine[];      // pagos fijos
  installments: CostLine[]; // cuotas de deudas
  cards: CostLine[];      // cuotas de tarjetas
  budgets: CostLine[];    // presupuestos (gastos variables)
  noInstallment: CostLine[]; // deudas sin cuota definida (no suman)
  total: number;
}

interface Ctx {
  businesses: Business[];
  recurring: Recurring[];
  debts: Debt[];
  cards: CardInfo[];
  budgets: Budget[];
  catById: (id: string | null | undefined) => Category | undefined;
  accById: (id: string | null | undefined) => Account | undefined;
  toCOP: (n: number, c: Currency) => number;
}

/** Cuánto cuesta el mes: pagos fijos + cuotas de deudas + cuotas de tarjetas + presupuestos */
export function monthlyCost(ctx: Ctx, businessIds: string[] | null): MonthlyCost {
  const inScope = (bid: string) => !businessIds || businessIds.includes(bid);
  const budgets = ctx.budgets.filter((b) => inScope(b.business_id));
  const budgetCats = new Set(budgets.map((b) => b.category_id).filter(Boolean) as string[]);

  const fixed: CostLine[] = ctx.recurring
    .filter((r) => r.kind === "expense" && inScope(r.business_id))
    .map((r) => {
      const covered = r.category_id && budgetCats.has(r.category_id);
      return {
        key: r.id, label: r.name, detail: `día ${r.day_of_month}`,
        amount: covered ? 0 : ctx.toCOP(r.amount, ctx.accById(r.account_id)?.currency ?? "COP"),
        note: covered ? "incluido en su presupuesto" : undefined,
      };
    });

  const installments: CostLine[] = [];
  const noInstallment: CostLine[] = [];
  for (const d of ctx.debts) {
    if (d.direction !== "owe" || d.excluded || d.remaining <= 0 || !inScope(d.business_id)) continue;
    const line = { key: d.id, label: d.person, detail: d.description ?? undefined, amount: 0 };
    if (d.installment) installments.push({ ...line, amount: ctx.toCOP(Math.min(d.installment, d.remaining), d.currency) });
    else noInstallment.push({ ...line, amount: ctx.toCOP(d.remaining, d.currency), note: "sin cuota definida" });
  }

  const cards: CostLine[] = ctx.cards
    .filter((c) => inScope(c.card.business_id) && c.totalDebt > 0)
    .map((c) => c.card.monthly_payment
      ? { key: c.card.id, label: c.card.name, detail: "cuota mensual", amount: c.card.monthly_payment }
      : { key: c.card.id, label: c.card.name, detail: "deuda total", amount: 0, note: "pon la cuota mensual en la tarjeta" });

  const budgetLines: CostLine[] = budgets.map((b) => ({
    key: b.id,
    label: b.name || ctx.catById(b.category_id)?.name || "Presupuesto general",
    detail: ctx.businesses.find((x) => x.id === b.business_id)?.name,
    amount: b.amount,
  }));

  const sum = (l: CostLine[]) => l.reduce((s, x) => s + x.amount, 0);
  return { fixed, installments, cards, budgets: budgetLines, noInstallment, total: sum(fixed) + sum(installments) + sum(cards) + sum(budgetLines) };
}

export function budgetSpent(b: Budget, txs: Tx[]): number {
  return txs
    .filter((t) => t.status === "confirmed" && t.kind === "expense" && t.business_id === b.business_id && (!b.category_id || t.category_id === b.category_id))
    .reduce((s, t) => s + t.amount_cop, 0);
}

// ------------------------------------------------------------------
//  Plan de la plata
// ------------------------------------------------------------------
export interface DebtTarget { key: string; label: string; detail: string; remaining: number; pay: number; reason: string }
export interface PlanResult {
  profit: number;
  profitByBiz: { name: string; profit: number }[];
  costOfLiving: number;
  salary: number;
  leftover: number;
  shortfall: number;
  emergency: { balance: number; target: number; months: number; accountName?: string; put: number };
  reinvest: number;
  fun: number;
  debtTotal: number;
  debts: DebtTarget[];
  extraSavings: number;
  tips: { tone: "ok" | "warn" | "danger" | "info"; text: string }[];
}

export function buildPlan(args: {
  ctx: Ctx;
  plan: PlanSettings;
  monthTxs: Tx[];
  prevMonthTxs: Tx[];
  balances: Record<string, number>;
  personalId: string | null;
  pendingCount: number;
}): PlanResult {
  const { ctx, plan, monthTxs, prevMonthTxs, balances, personalId } = args;
  const businesses = ctx.businesses.filter((b) => b.id !== personalId);
  const profitByBiz = businesses.map((b) => ({ name: b.name, profit: summarize(monthTxs, b.id, ctx.catById, b).myProfit }));
  const profit = profitByBiz.reduce((s, x) => s + x.profit, 0);

  const life = monthlyCost(ctx, personalId ? [personalId] : null);
  const costOfLiving = Math.round(life.total);
  const salary = Math.round(plan.salary && plan.salary > 0 ? plan.salary : costOfLiving);

  // Fondo de emergencia
  const months = plan.emergency_months ?? 3;
  const target = Math.round(costOfLiving * months);
  const fundAcc = ctx.accById(plan.emergency_account_id ?? null);
  const fundBal = fundAcc ? ctx.toCOP(balances[fundAcc.id] ?? 0, fundAcc.currency) : 0;
  const fundGap = Math.max(0, target - fundBal);

  const leftover = Math.max(0, profit - salary);
  const shortfall = Math.max(0, salary - Math.max(0, profit));

  // Reparto de lo que sobra después de tu sueldo
  const reinvest = Math.round((leftover * (plan.pct_reinvest ?? 20)) / 100);
  const fun = Math.round(leftover * 0.1);
  let rest = leftover - reinvest - fun;
  const put = Math.round(Math.min(fundGap, rest * (fundGap > 0 ? 0.35 : 0)));
  rest -= put;

  // Orden de pago de deudas: tarjetas primero (suelen cobrar más interés), luego mayor interés, luego bancos, luego la más pequeña
  type Cand = { key: string; label: string; detail: string; remaining: number; rank: number; rate: number; reason: string };
  const cands: Cand[] = [];
  for (const c of ctx.cards) {
    if (c.totalDebt <= 0) continue;
    cands.push({ key: c.card.id, label: c.card.name, detail: "tarjeta de crédito", remaining: c.totalDebt, rank: 0, rate: 99, reason: "Las tarjetas suelen cobrar el interés más alto" });
  }
  for (const d of ctx.debts) {
    if (d.direction !== "owe" || d.excluded || d.remaining <= 0) continue;
    const bank = /banco|tarjeta|crédito|credito|financiera|davivienda|bancolombia/i.test(`${d.person} ${d.category ?? ""}`);
    const rate = d.interest_rate ?? (bank ? 1.5 : 0);
    cands.push({
      key: d.id, label: d.person, detail: d.description ?? d.category ?? "deuda",
      remaining: ctx.toCOP(d.remaining, d.currency),
      rank: d.interest_rate ? 1 : bank ? 2 : 3, rate,
      reason: d.interest_rate ? `Cobra ${d.interest_rate}% mensual` : bank ? "Deuda con entidad: puede generar intereses y reportes" : "Sin intereses: la más pequeña primero para cerrarla rápido",
    });
  }
  cands.sort((a, b) => a.rank - b.rank || b.rate - a.rate || a.remaining - b.remaining);
  const debtTotal = cands.reduce((s, c) => s + c.remaining, 0);
  const debts: DebtTarget[] = [];
  let pool = rest;
  for (const c of cands) {
    const pay = Math.max(0, Math.min(c.remaining, pool));
    pool -= pay;
    debts.push({ key: c.key, label: c.label, detail: c.detail, remaining: c.remaining, pay: Math.round(pay), reason: c.reason });
  }
  const extraSavings = Math.round(Math.max(0, pool));

  // Recomendaciones
  const tips: PlanResult["tips"] = [];
  if (profit <= 0) tips.push({ tone: "danger", text: "Este mes tus negocios todavía no dejan ganancia. Por ahora cubre solo lo esencial y evita compras grandes." });
  else if (shortfall > 0) tips.push({ tone: "warn", text: `Lo que van ganando tus negocios aún no alcanza para tu sueldo: faltan ${fmt(shortfall)}. Revisa presupuestos y gastos hormiga.` });
  else tips.push({ tone: "ok", text: `Tus negocios cubren tu sueldo y sobran ${fmt(leftover)} para repartir.` });

  if (!fundAcc) tips.push({ tone: "info", text: "Elige una cuenta o bolsillo como fondo de emergencia (botón Ajustar). La meta recomendada es de 3 a 6 meses de tu costo de vida." });
  else if (fundGap > 0) tips.push({ tone: "warn", text: `Tu fondo de emergencia tiene ${fmt(fundBal)}: cubre ${(fundBal / Math.max(1, costOfLiving)).toFixed(1)} meses. La meta es ${months} meses (${fmt(target)}).` });
  else tips.push({ tone: "ok", text: `Tu fondo de emergencia ya cubre ${months} meses. 👏` });

  for (const c of ctx.cards) {
    if (c.limit > 0 && c.totalDebt / c.limit > 0.3) tips.push({ tone: "warn", text: `${c.card.name} usa el ${Math.round((c.totalDebt / c.limit) * 100)}% del cupo. Lo sano es menos del 30%: priorízala.` });
  }
  const overdueOwed = ctx.debts.filter((d) => d.direction === "owed" && d.remaining > 0 && d.next_due && new Date(d.next_due) < new Date(new Date().toDateString()));
  for (const d of overdueOwed.slice(0, 3)) tips.push({ tone: "info", text: `Cobra a ${d.person}: su pago (${d.description ?? "cuota"}) ya venció.` });

  for (const b of ctx.budgets) {
    const spent = budgetSpent(b, monthTxs);
    if (spent >= b.amount) tips.push({ tone: "danger", text: `Te pasaste del presupuesto de ${b.name || ctx.catById(b.category_id)?.name || "un negocio"}: llevas ${fmt(spent)} de ${fmt(b.amount)}.` });
    else if (spent >= b.amount * 0.8) tips.push({ tone: "warn", text: `Vas en el ${Math.round((spent / b.amount) * 100)}% del presupuesto de ${b.name || ctx.catById(b.category_id)?.name}.` });
  }

  // Categoría que más subió frente al mes pasado (solo personal)
  const byCat = (txs: Tx[]) => {
    const m = new Map<string, number>();
    for (const t of txs) if (t.status === "confirmed" && t.kind === "expense" && t.business_id === personalId && t.category_id) m.set(t.category_id, (m.get(t.category_id) ?? 0) + t.amount_cop);
    return m;
  };
  const now = byCat(monthTxs), prev = byCat(prevMonthTxs);
  let worst: { id: string; diff: number } | null = null;
  for (const [id, v] of now) { const d = v - (prev.get(id) ?? 0); if (d > 100000 && (!worst || d > worst.diff)) worst = { id, diff: d }; }
  if (worst) tips.push({ tone: "info", text: `Tu gasto en ${ctx.catById(worst.id)?.name} subió ${fmt(worst.diff)} frente al mes pasado.` });

  if (args.pendingCount > 0) tips.push({ tone: "info", text: `Tienes ${args.pendingCount} ${args.pendingCount === 1 ? "movimiento" : "movimientos"} por clasificar: clasifícalos para que estos números sean exactos.` });
  if (life.noInstallment.length) tips.push({ tone: "info", text: `${life.noInstallment.length === 1 ? "1 deuda no tiene" : life.noInstallment.length + " deudas no tienen"} cuota mensual. Ponles una cuota (aunque sea pequeña) para planear cómo cerrarlas.` });

  return {
    profit, profitByBiz, costOfLiving, salary, leftover, shortfall,
    emergency: { balance: fundBal, target, months, accountName: fundAcc?.name, put },
    reinvest, fun, debtTotal, debts, extraSavings, tips,
  };
}

const fmt = (n: number) => "$" + new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(n));
