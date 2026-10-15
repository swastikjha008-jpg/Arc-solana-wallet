import { useId } from "react";

/** The arc mark: a luminous electric-blue arch with a gaze point — an "arc" of light over a dark core. */
export function ArcMark({ size = 36 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="arc logo">
      <defs>
        <linearGradient id={`${id}-g`} x1="6" y1="40" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1d6bff" />
          <stop offset="0.55" stopColor="#3ca6ff" />
          <stop offset="1" stopColor="#9be4ff" />
        </linearGradient>
        <radialGradient id={`${id}-r`} cx="24" cy="32" r="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3ca6ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3ca6ff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-b`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#070b14" stroke="#3ca6ff" strokeOpacity="0.35" />
      <circle cx="24" cy="32" r="14" fill={`url(#${id}-r)`} />
      <path d="M10 35 A14 14 0 0 1 38 35" stroke={`url(#${id}-g)`} strokeWidth="5" strokeLinecap="round" filter={`url(#${id}-b)`} opacity="0.7" />
      <path d="M10 35 A14 14 0 0 1 38 35" stroke={`url(#${id}-g)`} strokeWidth="4" strokeLinecap="round" />
      <path d="M16 35 A8 8 0 0 1 32 35" stroke="#cdeeff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="34" r="2.6" fill="#e8f7ff" />
    </svg>
  );
}

export function ArcLogo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ArcMark size={size} />
      <span className="font-mono text-xl font-semibold tracking-[0.18em] text-white">arc</span>
    </span>
  );
}
