"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useData } from "@/lib/store";
import { BusinessSwitcher } from "./Business";

/** Barra superior: selector de negocio a la izquierda y tu perfil (Más) a la derecha */
export function TopBar({ right }: { right?: ReactNode }) {
  const { settings, session } = useData();
  const name = settings.display_name || session?.user.email || "?";
  return (
    <div className="topbar">
      <BusinessSwitcher />
      <div className="actions">
        {right}
        <Link href="/mas" className="me-btn" aria-label="Más opciones y ajustes">{name.trim().charAt(0).toUpperCase()}</Link>
      </div>
    </div>
  );
}
