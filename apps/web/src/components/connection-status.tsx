"use client";

import { Wifi, WifiOff, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/sse-client";

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  onReconnect?: () => void;
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatusIndicator({
  status,
  onReconnect,
  className,
  showLabel = false,
}: ConnectionStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Wifi,
          color: "text-success",
          bgColor: "bg-success/10",
          label: "Live",
          animate: false,
        };
      case "connecting":
        return {
          icon: Loader2,
          color: "text-warning",
          bgColor: "bg-warning/10",
          label: "Connecting",
          animate: true,
        };
      case "error":
        return {
          icon: AlertTriangle,
          color: "text-error",
          bgColor: "bg-error/10",
          label: "Error",
          animate: false,
        };
      case "disconnected":
      default:
        return {
          icon: WifiOff,
          color: "text-muted",
          bgColor: "bg-muted/10",
          label: "Offline",
          animate: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <button
      onClick={status !== "connected" && status !== "connecting" ? onReconnect : undefined}
      disabled={status === "connected" || status === "connecting"}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors",
        config.bgColor,
        status !== "connected" && status !== "connecting" && "hover:opacity-80 cursor-pointer",
        className
      )}
      title={status === "error" || status === "disconnected" ? "Click to reconnect" : undefined}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          config.color,
          config.animate && "animate-spin"
        )}
      />
      {showLabel && (
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      )}
    </button>
  );
}

// Compact dot-style indicator for tight spaces
interface ConnectionDotProps {
  status: ConnectionStatus;
  className?: string;
}

export function ConnectionDot({ status, className }: ConnectionDotProps) {
  const getColor = () => {
    switch (status) {
      case "connected":
        return "bg-success";
      case "connecting":
        return "bg-warning animate-pulse";
      case "error":
        return "bg-error";
      case "disconnected":
      default:
        return "bg-muted";
    }
  };

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        getColor(),
        className
      )}
      title={status}
    />
  );
}
