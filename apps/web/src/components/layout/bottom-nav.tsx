"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flag, MapPin, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badge?: number;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/rounds", label: "Rounds", icon: Flag },
  { href: "/buddies", label: "Buddies", icon: Users },
  { href: "/courses", label: "Courses", icon: MapPin },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0f1a]/95 backdrop-blur-xl border-t border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

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
                "relative p-2.5 rounded-xl transition-all",
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
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1 border-2 border-[#0a0f1a]">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[11px] font-medium mt-1 transition-colors",
                isActive && "text-brand font-semibold"
              )}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
