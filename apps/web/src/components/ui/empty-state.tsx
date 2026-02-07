"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import Link from "next/link";

interface EmptyStateProps {
  illustration?: React.ReactNode;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export function EmptyState({
  illustration,
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-xl py-12 px-6 text-center",
        className
      )}
    >
      {/* Illustration or Icon */}
      {illustration && (
        <div className="w-28 h-28 mx-auto mb-6 animate-float">
          {illustration}
        </div>
      )}
      {icon && !illustration && (
        <div className="w-16 h-16 mx-auto mb-4 text-muted opacity-60">
          {icon}
        </div>
      )}

      {/* Title */}
      <p className="text-lg font-semibold text-white">{title}</p>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted mt-2 max-w-xs mx-auto">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href}>
              <Button>
                {action.icon}
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button onClick={action.onClick}>
              {action.icon}
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
