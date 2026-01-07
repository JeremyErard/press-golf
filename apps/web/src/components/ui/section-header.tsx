"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  seeAllHref,
  seeAllLabel = "See All",
  count,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-3", className)}>
      <div className="flex items-center gap-2">
        <h2 className="text-h3 font-semibold text-white">{title}</h2>
        {count !== undefined && (
          <span className="text-caption text-muted">({count})</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {action}
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-sm text-brand font-medium hover:text-brand-dark transition-colors"
          >
            {seeAllLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
