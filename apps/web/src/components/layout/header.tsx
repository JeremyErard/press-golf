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
        "sticky top-0 z-40 glass border-b border-border safe-area-top",
        className
      )}
    >
      <div className="flex items-center justify-between h-14 px-lg max-w-lg mx-auto">
        {/* Left section */}
        <div className="w-10">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 -ml-2 rounded-full hover:bg-surface transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Title */}
        <h1 className="text-h3 font-semibold truncate">{title}</h1>

        {/* Right section */}
        <div className="w-10 flex justify-end">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
