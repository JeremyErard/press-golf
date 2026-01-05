import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(absAmount);

  return isNegative ? `-${formatted}` : `+${formatted}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

// Tee color mapping - provides consistent colors based on tee name
const TEE_COLOR_MAP: Record<string, string> = {
  // Black variants
  black: "#000000",
  championship: "#000000",
  tips: "#000000",
  // Blue variants
  blue: "#2563EB",
  // White variants
  white: "#FFFFFF",
  member: "#FFFFFF",
  // Gold variants
  gold: "#EAB308",
  senior: "#EAB308",
  // Red variants
  red: "#DC2626",
  forward: "#DC2626",
  ladies: "#DC2626",
  // Green variants
  green: "#16A34A",
};

export function getTeeColor(teeName: string, dbColor?: string | null): string {
  // If database has a valid color (not white/gray fallback), use it
  if (dbColor && dbColor !== "#FFFFFF" && dbColor !== "#808080" && dbColor !== "#D1D5DB") {
    // Check if the color makes sense for the tee name
    const lowerName = teeName.toLowerCase();

    // Black tees should always be black
    if ((lowerName.includes("black") || lowerName.includes("championship") || lowerName.includes("tips")) && dbColor !== "#000000") {
      return "#000000";
    }

    return dbColor;
  }

  // Fallback: derive color from tee name
  const lowerName = teeName.toLowerCase();

  for (const [key, color] of Object.entries(TEE_COLOR_MAP)) {
    if (lowerName.includes(key)) {
      return color;
    }
  }

  // Default fallback - use database color or gray
  return dbColor || "#6B7280";
}
