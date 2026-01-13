"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Sheet content */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col">
        {children}
      </div>
    </div>
  );
}

interface SheetContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetContent({ children, className }: SheetContentProps) {
  return (
    <div
      className={cn(
        "bg-surface border-t border-border rounded-t-3xl max-h-[90vh] animate-in slide-in-from-bottom duration-300",
        className
      )}
    >
      {/* Handle bar - centered at top */}
      <div className="flex justify-center py-3 flex-shrink-0">
        <div className="w-12 h-1.5 rounded-full bg-white/20" />
      </div>
      {children}
    </div>
  );
}

interface SheetHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetHeader({ children, className }: SheetHeaderProps) {
  return (
    <div className={cn("px-5 pb-4", className)}>
      {children}
    </div>
  );
}

interface SheetTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetTitle({ children, className }: SheetTitleProps) {
  return (
    <h2 className={cn("text-xl font-semibold text-white", className)}>
      {children}
    </h2>
  );
}

interface SheetDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function SheetDescription({ children, className }: SheetDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted mt-1", className)}>
      {children}
    </p>
  );
}
