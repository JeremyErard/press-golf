"use client";

import { Crown, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionStatusCardProps {
  status: "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "FOUNDING";
  endsAt?: string;
  isFoundingMember: boolean;
  onClick?: () => void;
}

export function SubscriptionStatusCard({
  status,
  endsAt,
  isFoundingMember,
  onClick,
}: SubscriptionStatusCardProps) {
  // Founding members get special treatment regardless of status
  const effectiveStatus = isFoundingMember ? "FOUNDING" : status;

  const config = {
    FOUNDING: {
      title: "Founding Member",
      subtitle: "Free forever",
      icon: Sparkles,
      bgClass: "bg-accent/10 border-accent/30",
      iconClass: "text-accent",
      titleClass: "text-accent",
    },
    ACTIVE: {
      title: "Press Pro",
      subtitle: endsAt
        ? `Renews ${new Date(endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : "Active subscription",
      icon: Crown,
      bgClass: "bg-brand/10 border-brand/30",
      iconClass: "text-brand",
      titleClass: "text-brand",
    },
    PAST_DUE: {
      title: "Press Pro",
      subtitle: "Payment issue - please update",
      icon: Crown,
      bgClass: "bg-error/10 border-error/30",
      iconClass: "text-error",
      titleClass: "text-error",
    },
    CANCELED: {
      title: "Press Pro",
      subtitle: endsAt
        ? `Access until ${new Date(endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : "Subscription canceled",
      icon: Crown,
      bgClass: "bg-muted/10 border-muted/30",
      iconClass: "text-muted",
      titleClass: "text-muted",
    },
    FREE: {
      title: "Free Plan",
      subtitle: "Upgrade to unlock all features",
      icon: Crown,
      bgClass: "bg-amber-500/10 border-amber-500/30",
      iconClass: "text-amber-500",
      titleClass: "text-amber-500",
    },
  };

  const { title, subtitle, icon: Icon, bgClass, iconClass, titleClass } =
    config[effectiveStatus];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-xl border transition-all",
        "flex items-center gap-3 text-left",
        "hover:opacity-90 active:scale-[0.99]",
        bgClass
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          effectiveStatus === "FOUNDING" ? "bg-accent/20" : "bg-current/10",
          iconClass
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-semibold", titleClass)}>{title}</p>
        <p className="text-sm text-muted truncate">{subtitle}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted flex-shrink-0" />
    </button>
  );
}
