"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flag, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/rounds", label: "Rounds", icon: Flag },
  { href: "/courses", label: "Courses", icon: MapPin },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-full transition-colors",
                isActive ? "text-brand" : "text-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-label mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
