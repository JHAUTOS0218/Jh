import type { AccountType } from "@/lib/types";
import { IBank, ICard, ICash, IPocket, IWallet } from "./Icons";

export function AccountIcon({ type, size = 40 }: { type: AccountType; size?: number }) {
  const I = type === "bank" ? IBank : type === "pocket" ? IPocket : type === "cash" ? ICash : type === "card" ? ICard : IWallet;
  return (
    <span className="ico" style={{ width: size, height: size, background: "var(--petrol-soft)", color: "var(--petrol)" }}>
      <I size={size * 0.48} />
    </span>
  );
}
