"use client";

import { HelpCircle } from "lucide-react";

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
}

export function HelpButton({ onClick, className = "" }: HelpButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-full hover:bg-white/10 transition-colors ${className}`}
      aria-label="Help"
    >
      <HelpCircle className="w-5 h-5 text-white/60 hover:text-white/80" />
    </button>
  );
}
