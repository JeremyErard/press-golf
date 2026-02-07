"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
}

export function Header({ title, showBack = false, rightAction, className }: HeaderProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 glass border-b border-border",
        className
      )}
    >
      {/* Safe area spacer for notched devices */}
      <div className="safe-area-top" />
      <div className="flex items-center justify-between h-14 px-lg max-w-lg mx-auto">
        {/* Left section */}
        <div className="w-11">
          {showBack && (
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/dashboard");
                }
              }}
              className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-surface active:bg-elevated active:scale-95 transition-all"
              aria-label="Go back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Title */}
        <h1 className="text-h3 font-semibold truncate">{title}</h1>

        {/* Right section */}
        <div className="w-11 flex justify-end">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
