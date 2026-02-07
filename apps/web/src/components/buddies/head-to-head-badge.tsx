"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api, type HeadToHeadRecord } from "@/lib/api";

interface HeadToHeadBadgeProps {
  opponentId: string;
  compact?: boolean;
}

function formatMoney(amount: number): string {
  if (amount === 0) return "$0";
  const sign = amount >= 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(0)}`;
}

export function HeadToHeadBadge({ opponentId, compact = false }: HeadToHeadBadgeProps) {
  const { getToken } = useAuth();
  const [record, setRecord] = useState<HeadToHeadRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchRecord() {
      try {
        const token = await getToken();
        if (!token || !mounted) return;

        const data = await api.getHeadToHead(token, opponentId);
        if (mounted) {
          setRecord(data);
        }
      } catch {
        // Silently fail - no H2H data available
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchRecord();

    return () => {
      mounted = false;
    };
  }, [getToken, opponentId]);

  if (isLoading || !record || record.roundsTogether === 0) {
    return null;
  }

  const { wins, losses, ties } = record.record;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted">
          {wins}W-{losses}L{ties > 0 ? `-${ties}T` : ""}
        </span>
        <span
          className={`font-medium ${
            record.netEarnings > 0
              ? "text-brand"
              : record.netEarnings < 0
              ? "text-error"
              : "text-muted"
          }`}
        >
          {formatMoney(record.netEarnings)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
      <div className="text-center">
        <p className="text-xs text-muted uppercase tracking-wide">Record</p>
        <p className="font-semibold text-foreground">
          {wins}-{losses}{ties > 0 ? `-${ties}` : ""}
        </p>
      </div>
      <div className="w-px h-8 bg-white/10" />
      <div className="text-center">
        <p className="text-xs text-muted uppercase tracking-wide">Lifetime</p>
        <p
          className={`font-semibold ${
            record.netEarnings > 0
              ? "text-brand"
              : record.netEarnings < 0
              ? "text-error"
              : "text-foreground"
          }`}
        >
          {formatMoney(record.netEarnings)}
        </p>
      </div>
      <div className="w-px h-8 bg-white/10" />
      <div className="text-center">
        <p className="text-xs text-muted uppercase tracking-wide">Rounds</p>
        <p className="font-semibold text-foreground">{record.roundsTogether}</p>
      </div>
    </div>
  );
}
