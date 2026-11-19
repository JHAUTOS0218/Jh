"use client";

import { useEffect, useState } from "react";
import { useData, normalizeTx } from "@/lib/store";
import { sb, errorText } from "@/lib/supabase";
import { dayLabel, money } from "@/lib/format";
import type { Tx } from "@/lib/types";
import { BackBar } from "@/components/BackBar";
import { SwipeRow, toast } from "@/components/ui";
import { IInbox, ITrash } from "@/components/Icons";

/** Busca la clasificación más probable: lo que usaste antes en ese mismo comercio, y la cuenta según la tarjeta o los últimos 4 dígitos */
async function suggest(t: Tx, accounts: { id: string; name: string; bank: string | null; type: string }[]): Promise<Partial<Tx>> {
  const out: Partial<Tx> = {};
  const desc = (t.description ?? "").trim();
  if (desc) {
    const key = desc.split(" ").slice(0, 2).join(" ").replace(/[%,()]/g, "");
    const { data } = await sb().from("transactions").select("business_id,category_id,account_id,kind")
      .eq("status", "confirmed").ilike("description", `%${key}%`).order("date", { ascending: false }).limit(1);
    const prev = data?.[0];
    if (prev) { out.business_id = prev.business_id; out.category_id = prev.category_id; out.account_id = prev.account_id; }
  }
  const raw = (t.raw_text ?? "").toLowerCase();
  const digits = raw.match(/\*(\d{4})/)?.[1];
  const card = raw.match(/tarjeta: ([^\n·]+)/)?.[1]?.trim();
  const byDigits = digits ? accounts.find((a) => `${a.name} ${a.bank ?? ""}`.includes(digits)) : undefined;
  const byCard = card ? accounts.find((a) => card.split(/\s+/).some((w) => w.length > 3 && `${a.name} ${a.bank ?? ""}`.toLowerCase().includes(w))) : undefined;
  const acc = byDigits ?? byCard;
  if (acc) out.account_id = acc.id;
  return out;
}

export default function Inbox() {
  const { openTx, version, accounts, bump, txDraft } = useData();
  const [items, setItems] = useState<(Tx & { raw_text?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb().from("transactions").select("*").eq("status", "pending").order("created_at", { ascending: false })
      .then(({ data }) => { setItems(((data as Tx[]) ?? []).map(normalizeTx)); setLoading(false); });
  }, [version, txDraft]);

  const classify = async (t: Tx) => {
    const s = await suggest(t, accounts);
    openTx({ ...t, ...s, status: "pending" });
  };

  const discard = async (t: Tx) => {
    if (!confirm("¿Descartar este movimiento? (por ejemplo si quedó repetido)")) return;
    const { error } = await sb().from("transactions").delete().eq("id", t.id);
    if (error) return toast(errorText(error));
    toast("Descartado");
    bump();
  };

  return (
    <main className="page">
      <BackBar title="Por clasificar" fallback="/" />
      <p className="muted small" style={{ margin: "-6px 2px 12px" }}>
        Llegan solos desde Apple Pay y los SMS del banco. Tócalos para decir de qué negocio y categoría son. Mientras no los clasifiques, no afectan saldos ni utilidades.
      </p>
      {loading ? <div className="spinner" /> : !items.length ? (
        <div className="empty">
          <div className="big-ico"><IInbox size={28} /></div>
          <b>Todo clasificado ✓</b>
          Cuando pagues con Apple Pay o te llegue un SMS de compra, aparecerá aquí.
        </div>
      ) : (
        <div className="list">
          {items.map((t) => (
            <SwipeRow key={t.id} onTap={() => classify(t)} actions={[{ label: "Descartar", color: "#b2463a", icon: <ITrash size={18} />, onClick: () => discard(t) }]}>
              <div className="row">
                <span className={"ico " + t.kind}><IInbox size={18} /></span>
                <div className="main">
                  <div className="t1">{t.description || (t.kind === "income" ? "Ingreso" : "Compra")}</div>
                  <div className="t2">{dayLabel(t.date)} · {t.source === "sms" ? "SMS del banco" : t.source === "applepay" ? "Apple Pay" : t.source}</div>
                </div>
                <div className={"amt num " + t.kind}>
                  {t.kind === "income" ? "+" : "-"}{money(t.amount)}
                  <span className="s" style={{ color: "var(--petrol)", fontWeight: 700 }}>Clasificar ›</span>
                </div>
              </div>
            </SwipeRow>
          ))}
        </div>
      )}
      {items.length > 0 && <p className="muted xsmall" style={{ textAlign: "center", marginTop: 14 }}>Desliza a la izquierda para descartar uno repetido.</p>}
    </main>
  );
}
