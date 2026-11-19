"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store";
import { IChart, IHandCoins, IHome, IList, IPlus } from "./Icons";

export function TabBar() {
  const path = usePathname();
  const { openTx } = useData();
  const on = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));
  return (
    <nav className="tabbar">
      <div className="inner">
        <Link href="/" className={"tab" + (on("/") ? " on" : "")}><IHome />Inicio</Link>
        <Link href="/movimientos" className={"tab" + (on("/movimientos") ? " on" : "")}><IList />Movimientos</Link>
        <button className="fab" onClick={() => openTx()} aria-label="Registrar movimiento"><IPlus size={28} strokeWidth={2.2} /></button>
        <Link href="/deudas" className={"tab" + (on("/deudas") ? " on" : "")}><IHandCoins />Deudas</Link>
        <Link href="/estadisticas" className={"tab" + (on("/estadisticas") ? " on" : "")}><IChart />Estadísticas</Link>
      </div>
    </nav>
  );
}
