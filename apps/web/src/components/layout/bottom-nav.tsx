"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flag, MapPin, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/rounds", label: "Rounds", icon: Flag },
  { href: "/buddies", label: "Buddies", icon: Users },
  { href: "/courses", label: "Courses", icon: MapPin },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0f1a]/95 backdrop-blur-xl border-t border-white/10">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-2 min-h-[56px] transition-all active:scale-95",
                isActive
                  ? "text-brand"
                  : "text-gray-500 active:text-gray-300"
              )}
            >
              <div className={cn(
                "p-2.5 rounded-xl transition-all",
                isActive && "bg-brand/10"
              )}>
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span className={cn(
                "text-[11px] font-medium mt-1 transition-colors",
                isActive && "text-brand font-semibold"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area spacer for notched devices */}
      <div className="safe-area-bottom" />
    </nav>
  );
}
