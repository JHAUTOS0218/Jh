/** Logo de la app: JH sobre verde dinero, con un gran signo $ al fondo */
export function BrandMark({ size = 76, radius }: { size?: number; radius?: number }) {
  const r = radius ?? size * 0.28;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="JH Finanzas" style={{ display: "block", flex: "none", filter: "drop-shadow(0 10px 22px rgba(15, 74, 48, 0.32))" }}>
      <defs>
        <linearGradient id="jh-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2FA36A" />
          <stop offset="0.55" stopColor="#1C7A4B" />
          <stop offset="1" stopColor="#0E4A2E" />
        </linearGradient>
        <linearGradient id="jh-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.35" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D5DDD8" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx={(r / size) * 100} fill="url(#jh-bg)" />
      <text x="50" y="80" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="96" fill="#7FE0AE" opacity="0.28">$</text>
      <text x="50" y="61" textAnchor="middle" fontFamily="Michroma, 'Arial Black', sans-serif" fontSize="30" letterSpacing="0.5" fill="url(#jh-silver)">JH</text>
      <rect x="31" y="70" width="38" height="1.4" rx="0.7" fill="#CFE9DA" opacity="0.7" />
    </svg>
  );
}
