"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Calendar, MapPin, Play } from "lucide-react";
import { Card, CardContent, Avatar, Button, Badge } from "@/components/ui";
import { api, type Challenge } from "@/lib/api";
import { toast } from "sonner";
import { formatGameType } from "@/lib/game-utils";

interface ChallengeCardProps {
  challenge: Challenge;
  index?: number;
  onUpdated: () => void;
}

export function ChallengeCard({ challenge, index = 0, onUpdated }: ChallengeCardProps) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const isReceived = challenge.direction === "received";
  const isPending = challenge.status === "PENDING";
  const isAccepted = challenge.status === "ACCEPTED";

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.acceptChallenge(token, challenge.id);
      toast.success("Challenge accepted!");
      onUpdated();
    } catch (error) {
      console.error("Failed to accept challenge:", error);
      toast.error("Failed to accept challenge");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.declineChallenge(token, challenge.id);
      toast.success("Challenge declined");
      onUpdated();
    } catch (error) {
      console.error("Failed to decline challenge:", error);
      toast.error("Failed to decline challenge");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.cancelChallenge(token, challenge.id);
      toast.success("Challenge canceled");
      onUpdated();
    } catch (error) {
      console.error("Failed to cancel challenge:", error);
      toast.error("Failed to cancel challenge");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRound = () => {
    // Navigate to create round with challenge pre-populated
    const params = new URLSearchParams();
    params.set("challengeId", challenge.id);
    if (challenge.courseId) {
      params.set("courseId", challenge.courseId);
    }
    router.push(`/rounds/new?${params.toString()}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = () => {
    switch (challenge.status) {
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "ACCEPTED":
        return <Badge variant="success">Accepted</Badge>;
      case "DECLINED":
        return <Badge variant="error">Declined</Badge>;
      case "EXPIRED":
        return <Badge variant="default">Expired</Badge>;
      case "COMPLETED":
        return <Badge variant="success">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card
      className="glass-card animate-fade-in-up"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <CardContent className="p-md">
        {/* Direction indicator and opponent */}
        <div className="flex items-center gap-md mb-md">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
            isReceived ? "bg-green-500/20" : "bg-blue-500/20"
          }`}>
            {isReceived ? (
              <ArrowDown className="h-4 w-4 text-green-400" />
            ) : (
              <ArrowUp className="h-4 w-4 text-blue-400" />
            )}
          </div>
          <Avatar
            className="h-10 w-10"
            src={challenge.opponent.avatarUrl}
            name={challenge.opponent.displayName || challenge.opponent.firstName || "?"}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {isReceived ? "From " : "To "}
              {challenge.opponent.displayName || challenge.opponent.firstName || "Unknown"}
            </p>
            <p className="text-sm text-muted">
              ${challenge.betAmount} {formatGameType(challenge.gameType)}
            </p>
          </div>
          {!isPending && !isAccepted && getStatusBadge()}
        </div>

        {/* Challenge details */}
        <div className="flex flex-wrap gap-sm text-sm text-muted mb-md">
          {challenge.proposedDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(challenge.proposedDate)}
            </span>
          )}
          {challenge.courseName && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {challenge.courseName}
            </span>
          )}
        </div>

        {/* Message */}
        {challenge.message && (
          <p className="text-sm text-foreground/80 italic mb-md">
            "{challenge.message}"
          </p>
        )}

        {/* Actions */}
        {isPending && isReceived && (
          <div className="flex gap-sm">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDecline}
              disabled={isLoading}
            >
              Decline
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleAccept}
              disabled={isLoading}
            >
              Accept
            </Button>
          </div>
        )}

        {isPending && !isReceived && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel Challenge
          </Button>
        )}

        {isAccepted && (
          <Button
            size="sm"
            className="w-full"
            onClick={handleStartRound}
          >
            <Play className="h-4 w-4 mr-2" />
            Start Round
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
