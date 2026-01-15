"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = "md",
  className,
}: ToggleProps) {
  const sizes = {
    sm: {
      track: "w-10 h-5",
      thumb: "w-3 h-3 top-1 left-1",
      translate: "translate-x-5",
    },
    md: {
      track: "w-12 h-6",
      thumb: "w-4 h-4 top-1 left-1",
      translate: "translate-x-6",
    },
  };

  const { track, thumb, translate } = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background",
        track,
        checked ? "bg-brand" : "bg-muted-foreground/20",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "absolute bg-white rounded-full transition-transform shadow-sm",
          thumb,
          checked && translate
        )}
      />
    </button>
  );
}
