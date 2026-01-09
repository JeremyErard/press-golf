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

/**
 * Format course name for proper capitalization.
 * Handles common golf abbreviations and title casing.
 * Examples: "Cc Of Lansing" → "CC of Lansing", "PEBBLE BEACH GC" → "Pebble Beach GC"
 */
export function formatCourseName(name: string): string {
  if (!name) return name;

  // Common golf abbreviations that should be uppercase
  const golfAbbreviations = ["cc", "gc", "g.c.", "c.c."];
  // Words that should be lowercase (unless first word)
  const lowercaseWords = ["of", "the", "at", "and", "in", "on", "by", "for"];

  // Split into words and process each
  const words = name.split(/\s+/);

  return words
    .map((word, index) => {
      const lowerWord = word.toLowerCase();

      // Golf abbreviations should be uppercase
      if (golfAbbreviations.includes(lowerWord)) {
        return word.toUpperCase();
      }

      // Common lowercase words (except if first word)
      if (index > 0 && lowercaseWords.includes(lowerWord)) {
        return lowerWord;
      }

      // Title case: first letter uppercase, rest lowercase
      // But preserve all-caps if it looks intentional (2+ letters)
      if (word === word.toUpperCase() && word.length > 2) {
        // Convert from ALL CAPS to Title Case
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      // Standard title case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Format tee name for display with optional "Tees" suffix.
 * Avoids redundant suffixes like "'64 Course Tees" by detecting
 * when the name already contains descriptive terms.
 */
export function formatTeeDisplayName(teeName: string, includeTeesSuffix = true): string {
  if (!teeName) return "Tees";

  const lowerName = teeName.toLowerCase().trim();

  // Don't add "Tees" if name already ends with it
  if (lowerName.endsWith("tees") || lowerName.endsWith("tee")) {
    return teeName;
  }

  // Don't add "Tees" if name contains descriptive course-related terms
  // This handles cases like "'64 Course" which would be redundant as "'64 Course Tees"
  if (lowerName.includes("course")) {
    return teeName;
  }

  // For standard tee names (Blue, Black, White, etc.) add "Tees" suffix
  return includeTeesSuffix ? `${teeName} Tees` : teeName;
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
