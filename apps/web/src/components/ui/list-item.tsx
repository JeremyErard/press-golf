"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListItemProps {
  /** Left side icon container */
  icon?: React.ReactNode;
  /** Primary text */
  title: string;
  /** Secondary text below title */
  subtitle?: string;
  /** Right side content (badge, amount, etc) */
  trailing?: React.ReactNode;
  /** Show chevron indicator */
  showChevron?: boolean;
  /** Navigation href */
  href?: string;
  /** Click handler (for non-navigation actions) */
  onClick?: () => void;
  /** Additional className */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export function ListItem({
  icon,
  title,
  subtitle,
  trailing,
  showChevron = true,
  href,
  onClick,
  className,
  disabled = false,
}: ListItemProps) {
  const content = (
    <>
      {/* Icon */}
      {icon && (
        <div className="w-11 h-11 rounded-full bg-elevated flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}

      {/* Text Content */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-body font-medium text-white truncate">{title}</p>
        {subtitle && (
          <p className="text-caption text-muted truncate">{subtitle}</p>
        )}
      </div>

      {/* Trailing Content */}
      {trailing && <div className="shrink-0">{trailing}</div>}

      {/* Chevron */}
      {showChevron && (
        <ChevronRight className="h-5 w-5 text-muted shrink-0 transition-transform group-hover:translate-x-0.5" />
      )}
    </>
  );

  const baseClassName = cn(
    "group w-full flex items-center gap-3 p-4 min-h-[64px]",
    "hover:bg-surface active:bg-elevated transition-colors",
    disabled && "opacity-50 pointer-events-none",
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={baseClassName} disabled={disabled}>
      {content}
    </button>
  );
}

interface ListItemGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function ListItemGroup({ children, className }: ListItemGroupProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl border border-border overflow-hidden divide-y divide-border",
        className
      )}
    >
      {children}
    </div>
  );
}
