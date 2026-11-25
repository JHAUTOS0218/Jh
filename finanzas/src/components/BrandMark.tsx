/** Logo de la app: JH en letra fina plateada sobre negro, con un brillo verde suave */
export function BrandMark({ size = 76, radius }: { size?: number; radius?: number }) {
  const r = radius ?? size * 0.28;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="JH Finanzas" style={{ display: "block", flex: "none", filter: "drop-shadow(0 12px 26px rgba(0, 0, 0, 0.45))" }}>
      <defs>
        <linearGradient id="jhm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2521" />
          <stop offset="1" stopColor="#070b0a" />
        </linearGradient>
        <radialGradient id="jhm-glow" cx="0.85" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#2fd394" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#2fd394" stopOpacity="0.06" />
          <stop offset="1" stopColor="#2fd394" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="jhm-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c3ccc8" />
        </linearGradient>
        <linearGradient id="jhm-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2fd394" stopOpacity="0" />
          <stop offset="0.5" stopColor="#3fe0a2" />
          <stop offset="1" stopColor="#2fd394" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx={(r / size) * 100} fill="url(#jhm-bg)" />
      <rect width="100" height="100" rx={(r / size) * 100} fill="url(#jhm-glow)" />
      <rect x="0.5" y="0.5" width="99" height="99" rx={(r / size) * 100 - 0.5} fill="none" stroke="rgba(255,255,255,0.09)" />
      <text x="50" y="59" textAnchor="middle" fontFamily="Manrope, -apple-system, sans-serif" fontWeight="300" fontSize="34" letterSpacing="3" fill="url(#jhm-silver)">JH</text>
      <rect x="32" y="68" width="36" height="1.6" rx="0.8" fill="url(#jhm-line)" />
    </svg>
  );
}
