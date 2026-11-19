"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IChevL } from "./Icons";

export function BackBar({ title, right, fallback = "/mas" }: { title: string; right?: ReactNode; fallback?: string }) {
  const router = useRouter();
  return (
    <>
      <div className="topbar">
        <button className="icon-btn" onClick={() => (history.length > 1 ? router.back() : router.push(fallback))} aria-label="Atrás"><IChevL size={20} /></button>
        <div className="actions">{right}</div>
      </div>
      <h1 className="title" style={{ margin: "6px 2px 14px" }}>{title}</h1>
    </>
  );
}
