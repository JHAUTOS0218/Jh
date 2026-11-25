"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store";
import { IChart, IGrid, IHandCoins, IHome, IList, IPlus, ITarget } from "./Icons";

export function TabBar() {
  const path = usePathname();
  const { openTx } = useData();
  const on = (p: string) => (p === "/" ? path === "/" : path.startsWith(p));
  const tab = (href: string, icon: React.ReactNode, label: string) => (
    <Link href={href} className={"tab" + (on(href) ? " on" : "")}>{icon}<span>{label}</span></Link>
  );
  return (
    <>
      <button className="fab" onClick={() => openTx()} aria-label="Registrar movimiento"><IPlus size={28} strokeWidth={2.2} /></button>
      <nav className="tabbar">
        <div className="inner">
          {tab("/", <IHome />, "Inicio")}
          {tab("/movimientos", <IList />, "Movimientos")}
          {tab("/deudas", <IHandCoins />, "Deudas")}
          {tab("/activos", <ITarget />, "Activos")}
          {tab("/estadisticas", <IChart />, "Reportes")}
          {tab("/mas", <IGrid />, "Más")}
        </div>
      </nav>
    </>
  );
}
