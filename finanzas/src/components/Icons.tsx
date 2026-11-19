import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, ...p }: P, children: React.ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

export const IHome = (p: P) => base(p, <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>);
export const IList = (p: P) => base(p, <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>);
export const IChart = (p: P) => base(p, <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const IGrid = (p: P) => base(p, <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>);
export const IPlus = (p: P) => base(p, <path d="M12 5v14M5 12h14" />);
export const IClose = (p: P) => base(p, <path d="M18 6 6 18M6 6l12 12" />);
export const IChevR = (p: P) => base(p, <path d="m9 6 6 6-6 6" />);
export const IChevL = (p: P) => base(p, <path d="m15 6-6 6 6 6" />);
export const IChevD = (p: P) => base(p, <path d="m6 9 6 6 6-6" />);
export const IArrowUp = (p: P) => base(p, <path d="M12 19V5M5 12l7-7 7 7" />);
export const IArrowDown = (p: P) => base(p, <path d="M12 5v14M5 12l7 7 7-7" />);
export const ITransfer = (p: P) => base(p, <><path d="M4 8h14l-3-3" /><path d="M20 16H6l3 3" /></>);
export const ISearch = (p: P) => base({ size: 17, ...p }, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IEdit = (p: P) => base(p, <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>);
export const ITrash = (p: P) => base(p, <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>);
export const IWallet = (p: P) => base(p, <><path d="M20 7H5a2 2 0 0 1 0-4h13v4" /><path d="M3 5v14a2 2 0 0 0 2 2h15V7" /><circle cx="16" cy="14" r="1.2" /></>);
export const IBank = (p: P) => base(p, <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>);
export const ICash = (p: P) => base(p, <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>);
export const ICard = (p: P) => base(p, <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>);
export const IPocket = (p: P) => base(p, <><path d="M4 5h16v6a8 8 0 0 1-16 0Z" /><path d="m8 10 4 3 4-3" /></>);
export const IBriefcase = (p: P) => base(p, <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>);
export const IScale = (p: P) => base(p, <><path d="M12 3v18M5 21h14M5 7h14" /><path d="m5 7-3 7a3 3 0 0 0 6 0Z" /><path d="m19 7-3 7a3 3 0 0 0 6 0Z" /></>);
export const IDownload = (p: P) => base(p, <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>);
export const IDollar = (p: P) => base(p, <><path d="M12 2v20" /><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>);
export const ILogout = (p: P) => base(p, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>);
export const IAlert = (p: P) => base(p, <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>);
export const ISparkle = (p: P) => base(p, <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6 6 2 2M16 16l2 2M6 18l2-2M16 8l2-2" /></>);
export const ICalendar = (p: P) => base(p, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>);
export const ITarget = (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>);
export const IHandCoins = (p: P) => base(p, <><circle cx="16" cy="7" r="3" /><path d="M2 17h3l5 3 9-4a1.5 1.5 0 0 0-1-2.8L13 15H9" /><path d="M5 13h4a2 2 0 0 1 0 4" /></>);
export const IInbox = (p: P) => base(p, <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" /></>);
export const IPie = (p: P) => base(p, <><path d="M21 12A9 9 0 1 1 12 3v9Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15Z" /></>);
export const ITag = (p: P) => base(p, <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.2" /></>);
export const ISwap = (p: P) => base(p, <><path d="m7 4-4 4 4 4" /><path d="M3 8h13" /><path d="m17 20 4-4-4-4" /><path d="M21 16H8" /></>);
export const IArchive = (p: P) => base(p, <><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>);
