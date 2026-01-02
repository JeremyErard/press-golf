"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle, Clock, ChevronRight, RefreshCw } from "lucide-react";
import { api, HandicapStatusResponse } from "@/lib/api";

export function HandicapCard() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [status, setStatus] = useState<HandicapStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getHandicapStatus(token);
        setStatus(data);
      } catch (err) {
        console.error("Failed to fetch handicap status:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, [getToken]);

  const handleClick = () => {
    router.push("/onboarding/handicap");
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-elevated animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-elevated rounded animate-pulse" />
            <div className="h-3 w-32 bg-elevated rounded animate-pulse mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!status || status.status === "none") {
    return (
      <button
        onClick={handleClick}
        className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 hover:bg-amber-500/15 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="font-medium text-foreground">No Handicap Set</p>
              <p className="text-sm text-muted">Tap to add your handicap</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted" />
        </div>
      </button>
    );
  }

  const getStatusDisplay = () => {
    switch (status.status) {
      case "verified":
        return {
          icon: <CheckCircle className="w-5 h-5 text-brand" />,
          iconBg: "bg-brand/20",
          label: "Verified",
          sublabel: status.daysUntilExpiry !== null
            ? `Updates in ${status.daysUntilExpiry} days`
            : "Verified handicap",
          warning: false,
        };
      case "manual_pending":
        return {
          icon: <Clock className="w-5 h-5 text-amber-400" />,
          iconBg: "bg-amber-500/20",
          label: "Pending Approval",
          sublabel: "Awaiting round creator approval",
          warning: true,
        };
      case "expired":
        return {
          icon: <RefreshCw className="w-5 h-5 text-amber-400" />,
          iconBg: "bg-amber-500/20",
          label: "Update Required",
          sublabel: "Your handicap is over 30 days old",
          warning: true,
        };
      default:
        return {
          icon: <CheckCircle className="w-5 h-5 text-muted" />,
          iconBg: "bg-elevated",
          label: "Handicap",
          sublabel: "",
          warning: false,
        };
    }
  };

  const display = getStatusDisplay();

  return (
    <button
      onClick={handleClick}
      className={`w-full rounded-xl p-4 transition-colors ${
        display.warning
          ? "bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15"
          : "bg-card border border-border hover:bg-card-hover"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${display.iconBg} flex items-center justify-center`}>
            {display.icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">
                {status.handicapIndex?.toFixed(1) ?? "—"}
              </span>
              <span className="text-xs text-muted uppercase tracking-wide">
                {display.label}
              </span>
            </div>
            <p className="text-sm text-muted">{display.sublabel}</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted" />
      </div>
    </button>
  );
}
