// Empty state illustrations for the Press Golf app

interface IllustrationProps {
  className?: string;
}

// Golfer illustration for empty rounds
export function GolferIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Golf course background */}
      <ellipse cx="100" cy="170" rx="80" ry="20" fill="#166534" opacity="0.3" />
      <ellipse cx="100" cy="175" rx="60" ry="12" fill="#14532d" opacity="0.5" />

      {/* Golfer body */}
      <circle cx="100" cy="50" r="18" fill="#64748B" /> {/* Head */}
      <path
        d="M85 68 L80 120 L90 120 L95 85 L105 85 L110 120 L120 120 L115 68 Z"
        fill="#22c55e"
      /> {/* Body */}

      {/* Arms with club */}
      <path
        d="M82 75 Q60 90 55 110"
        stroke="#64748B"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M118 75 Q130 85 140 80"
        stroke="#64748B"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Golf club */}
      <line x1="55" y1="110" x2="45" y2="150" stroke="#94A3B8" strokeWidth="3" />
      <rect x="40" y="148" width="15" height="8" rx="2" fill="#334155" />

      {/* Legs */}
      <path d="M90 118 L85 155" stroke="#1E293B" strokeWidth="8" strokeLinecap="round" />
      <path d="M110 118 L115 155" stroke="#1E293B" strokeWidth="8" strokeLinecap="round" />

      {/* Golf ball */}
      <circle cx="150" cy="165" r="6" fill="white" />
      <circle cx="148" cy="163" r="1" fill="#E5E7EB" />
      <circle cx="152" cy="164" r="1" fill="#E5E7EB" />

      {/* Flag in distance */}
      <line x1="170" y1="120" x2="170" y2="155" stroke="#94A3B8" strokeWidth="2" />
      <path d="M170 120 L185 128 L170 136 Z" fill="#EF4444" />
    </svg>
  );
}

// Golf course/map illustration for empty courses
export function CourseMapIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Map background */}
      <rect x="30" y="30" width="140" height="140" rx="12" fill="#111d32" />
      <rect x="30" y="30" width="140" height="140" rx="12" stroke="#334155" strokeWidth="2" />

      {/* Course layout paths */}
      <path
        d="M50 80 Q80 60 100 80 Q120 100 150 85"
        stroke="#166534"
        strokeWidth="16"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M60 130 Q90 150 130 130 Q150 120 160 140"
        stroke="#166534"
        strokeWidth="16"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />

      {/* Water hazard */}
      <ellipse cx="80" cy="110" rx="20" ry="12" fill="#3B82F6" opacity="0.4" />

      {/* Sand bunker */}
      <ellipse cx="130" cy="95" rx="12" ry="8" fill="#F59E0B" opacity="0.4" />

      {/* Pin locations */}
      <circle cx="55" cy="75" r="4" fill="#EF4444" />
      <circle cx="145" cy="85" r="4" fill="#EF4444" />
      <circle cx="155" cy="140" r="4" fill="#EF4444" />

      {/* Location marker */}
      <g transform="translate(100, 45)">
        <path
          d="M0 -15 C-8 -15 -15 -8 -15 0 C-15 10 0 25 0 25 C0 25 15 10 15 0 C15 -8 8 -15 0 -15 Z"
          fill="#22c55e"
        />
        <circle cx="0" cy="-2" r="5" fill="white" />
      </g>

      {/* Compass */}
      <g transform="translate(155, 55)">
        <circle cx="0" cy="0" r="12" fill="#1a2942" stroke="#334155" />
        <path d="M0 -8 L3 4 L0 2 L-3 4 Z" fill="#EF4444" />
        <path d="M0 8 L3 -4 L0 -2 L-3 -4 Z" fill="#94A3B8" />
      </g>
    </svg>
  );
}

// Money/betting illustration for empty games
export function BettingIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle */}
      <circle cx="100" cy="100" r="70" fill="#111d32" />

      {/* Dollar sign */}
      <text
        x="100"
        y="125"
        textAnchor="middle"
        fontSize="80"
        fontWeight="bold"
        fill="#22c55e"
        opacity="0.8"
      >
        $
      </text>

      {/* Coins scattered */}
      <g opacity="0.6">
        <circle cx="45" cy="140" r="15" fill="#F59E0B" />
        <circle cx="45" cy="140" r="10" stroke="#FCD34D" strokeWidth="2" fill="none" />

        <circle cx="155" cy="135" r="12" fill="#F59E0B" />
        <circle cx="155" cy="135" r="8" stroke="#FCD34D" strokeWidth="2" fill="none" />

        <circle cx="60" cy="60" r="10" fill="#F59E0B" />
        <circle cx="60" cy="60" r="6" stroke="#FCD34D" strokeWidth="2" fill="none" />

        <circle cx="145" cy="55" r="14" fill="#F59E0B" />
        <circle cx="145" cy="55" r="9" stroke="#FCD34D" strokeWidth="2" fill="none" />
      </g>

      {/* Sparkles */}
      <g fill="#22c55e">
        <path d="M35 90 L38 85 L41 90 L38 95 Z" />
        <path d="M165 100 L168 95 L171 100 L168 105 Z" />
        <path d="M90 35 L93 30 L96 35 L93 40 Z" />
        <path d="M115 170 L118 165 L121 170 L118 175 Z" />
      </g>
    </svg>
  );
}

// Trophy illustration for completed rounds/leaderboard
export function TrophyIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Pedestal */}
      <rect x="70" y="160" width="60" height="15" rx="3" fill="#334155" />
      <rect x="80" y="145" width="40" height="18" rx="2" fill="#1E293B" />

      {/* Trophy base */}
      <rect x="85" y="130" width="30" height="18" rx="2" fill="#F59E0B" />

      {/* Trophy cup */}
      <path
        d="M60 50 L65 110 Q100 130 135 110 L140 50 Z"
        fill="url(#trophyGradient)"
      />

      {/* Trophy handles */}
      <path
        d="M60 60 Q30 60 35 85 Q40 105 60 100"
        stroke="#F59E0B"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M140 60 Q170 60 165 85 Q160 105 140 100"
        stroke="#F59E0B"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />

      {/* Star on trophy */}
      <path
        d="M100 65 L105 80 L120 80 L108 90 L113 105 L100 95 L87 105 L92 90 L80 80 L95 80 Z"
        fill="white"
        opacity="0.9"
      />

      {/* Shine effect */}
      <path
        d="M70 55 Q75 75 72 95"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />

      <defs>
        <linearGradient id="trophyGradient" x1="60" y1="50" x2="140" y2="130">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Golf flag illustration for general empty states
export function GolfFlagIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Ground */}
      <ellipse cx="100" cy="170" rx="70" ry="15" fill="#166534" opacity="0.4" />

      {/* Hole */}
      <ellipse cx="100" cy="168" rx="15" ry="5" fill="#0a1628" />

      {/* Flag pole */}
      <line x1="100" y1="40" x2="100" y2="165" stroke="#94A3B8" strokeWidth="3" />

      {/* Flag */}
      <path
        d="M100 40 L150 60 L100 80 Z"
        fill="#22c55e"
      />
      <path
        d="M100 40 L150 60 L100 80 Z"
        fill="url(#flagGradient)"
      />

      {/* Ball near hole */}
      <circle cx="125" cy="163" r="8" fill="white" />
      <circle cx="123" cy="161" r="1.5" fill="#E5E7EB" />
      <circle cx="127" cy="162" r="1.5" fill="#E5E7EB" />
      <circle cx="125" cy="166" r="1.5" fill="#E5E7EB" />

      {/* Grass tufts */}
      <g stroke="#166534" strokeWidth="2" strokeLinecap="round">
        <path d="M50 165 Q52 155 55 165" />
        <path d="M55 167 Q58 157 62 167" />
        <path d="M140 163 Q143 153 146 163" />
        <path d="M148 165 Q151 155 154 165" />
      </g>

      <defs>
        <linearGradient id="flagGradient" x1="100" y1="40" x2="150" y2="80">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
    </svg>
  );
}
