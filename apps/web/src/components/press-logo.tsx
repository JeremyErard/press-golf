import Image from "next/image";

interface PressLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeConfig = {
  sm: { width: 120, height: 32 },
  md: { width: 180, height: 48 },
  lg: { width: 240, height: 64 },
  xl: { width: 320, height: 85 },
};

export function PressLogo({ size = "xl", className = "" }: PressLogoProps) {
  const config = sizeConfig[size];

  return (
    <Image
      src="/icons/press-logo-p.png"
      alt="Press - Golf Betting Made Simple"
      width={config.width}
      height={config.height}
      className={`object-contain ${className}`}
      priority
      unoptimized
    />
  );
}
