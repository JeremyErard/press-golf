"use client";

import * as React from "react";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8 text-label",
  md: "h-10 w-10 text-caption",
  lg: "h-14 w-14 text-body",
};

export function Avatar({ src, name, size = "md", className, ...props }: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const showFallback = !src || imageError;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-elevated font-medium text-muted overflow-hidden",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {showFallback ? (
        <span>{getInitials(name)}</span>
      ) : (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}
