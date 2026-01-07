"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FABProps {
  /** Navigation href */
  href?: string;
  /** Click handler */
  onClick?: () => void;
  /** Icon to display (defaults to Plus) */
  icon?: React.ReactNode;
  /** Accessibility label */
  label?: string;
  /** Show/hide the FAB */
  show?: boolean;
  /** Additional className */
  className?: string;
}

export function FAB({
  href,
  onClick,
  icon,
  label = "Add new",
  show = true,
  className,
}: FABProps) {
  if (!show) return null;

  const buttonContent = (
    <button
      onClick={!href ? onClick : undefined}
      className={cn(
        "h-14 w-14 rounded-full bg-brand hover:bg-brand-dark",
        "flex items-center justify-center",
        "shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30",
        "active:scale-95 transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background",
        className
      )}
      aria-label={label}
    >
      {icon || <Plus className="h-6 w-6 text-white" />}
    </button>
  );

  const wrapper = (
    <div className="fixed bottom-24 right-4 z-40">
      {href ? <Link href={href}>{buttonContent}</Link> : buttonContent}
    </div>
  );

  return wrapper;
}
