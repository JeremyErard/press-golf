"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, X, Loader2, UserCheck } from "lucide-react";
import { api, HandicapApproval } from "@/lib/api";

export function PendingApprovals() {
  const { getToken } = useAuth();
  const [approvals, setApprovals] = useState<HandicapApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getPendingApprovals(token);
      setApprovals(data);
    } catch (err) {
      console.error("Failed to fetch pending approvals:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApproval = async (approvalId: string, status: "APPROVED" | "REJECTED") => {
    setProcessingId(approvalId);
    try {
      const token = await getToken();
      if (!token) return;
      await api.approveHandicap(token, approvalId, status);
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } catch (err) {
      console.error("Failed to process approval:", err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return null;
  }

  if (approvals.length === 0) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <UserCheck className="w-5 h-5 text-amber-400" />
        <h3 className="font-medium text-foreground">
          Handicap Approvals ({approvals.length})
        </h3>
      </div>

      <div className="space-y-3">
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className="bg-background/50 rounded-lg p-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {approval.user.avatarUrl ? (
                <img
                  src={approval.user.avatarUrl}
                  alt={approval.user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center text-muted font-medium">
                  {approval.user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {approval.user.name}
                </p>
                <p className="text-sm text-muted">
                  Claims <span className="text-foreground font-medium">{approval.handicap.toFixed(1)}</span> handicap
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {processingId === approval.id ? (
                <Loader2 className="w-5 h-5 text-muted animate-spin" />
              ) : (
                <>
                  <button
                    onClick={() => handleApproval(approval.id, "REJECTED")}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    title="Reject"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleApproval(approval.id, "APPROVED")}
                    className="p-2 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 transition-colors"
                    title="Approve"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted mt-3">
        As the round creator, you approve handicaps for players without verified handicaps.
      </p>
    </div>
  );
}
