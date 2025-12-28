import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-sm py-xs text-label font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface text-foreground border border-border",
        success: "bg-success/20 text-success border border-success/30",
        error: "bg-error/20 text-error border border-error/30",
        warning: "bg-warning/20 text-warning border border-warning/30",
        info: "bg-info/20 text-info border border-info/30",
        brand: "bg-brand/20 text-brand border border-brand/30",
        accent: "bg-accent/20 text-accent border border-accent/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
