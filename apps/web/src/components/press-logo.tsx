"use client";

interface PressLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

// The custom P with golf tee as vertical line - matches the app icon
function TeeP({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'baseline' }}
    >
      {/* Tee head (rounded rectangle at top) */}
      <rect x="4" y="2" width="20" height="8" rx="4" fill="#22c55e" />

      {/* Tee stem - tapers to point at bottom */}
      <path
        d="M9 10H19L16 58C16 60.5 15.1 62 14 62C12.9 62 12 60.5 12 58L9 10Z"
        fill="#22c55e"
      />

      {/* The bowl of the P - white curved part */}
      <path
        d="M19 4H30C38 4 44 10 44 20C44 30 38 36 30 36H19"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function PressLogo({ className = "", size = "lg" }: PressLogoProps) {
  const sizeClasses = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl md:text-7xl",
    xl: "text-7xl md:text-8xl",
  };

  const teeHeights = {
    sm: "h-8",
    md: "h-12",
    lg: "h-16 md:h-20",
    xl: "h-20 md:h-24",
  };

  return (
    <span className={`inline-flex items-baseline font-black tracking-tight ${sizeClasses[size]} ${className}`}>
      <TeeP className={`${teeHeights[size]} text-white -mr-1`} />
      <span className="inline-block transform skew-x-1">R</span>
      <span className="inline-block">E</span>
      <span className="inline-block transform skew-x-1">S</span>
      <span className="inline-block transform -skew-x-2">S</span>
    </span>
  );
}

export default PressLogo;
