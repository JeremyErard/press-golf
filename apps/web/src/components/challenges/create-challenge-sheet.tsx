"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, DollarSign } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, Button, Avatar } from "@/components/ui";
import { api, type Buddy, type GameType } from "@/lib/api";
import { formatGameType, ALL_GAME_TYPES } from "@/lib/game-utils";
import { toast } from "sonner";

interface CreateChallengeSheetProps {
  open: boolean;
  onClose: () => void;
  onChallengeCreated: () => void;
  buddies: Buddy[];
  preselectedBuddyId?: string;
}

export function CreateChallengeSheet({
  open,
  onClose,
  onChallengeCreated,
  buddies,
  preselectedBuddyId,
}: CreateChallengeSheetProps) {
  const { getToken } = useAuth();
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(preselectedBuddyId ?? null);
  const [gameType, setGameType] = useState<GameType>("NASSAU");
  const [betAmount, setBetAmount] = useState("20");
  const [proposedDate, setProposedDate] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedBuddyId) {
      toast.error("Please select a buddy to challenge");
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid bet amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.createChallenge(token, {
        challengedId: selectedBuddyId,
        gameType,
        betAmount: amount,
        proposedDate: proposedDate || undefined,
        message: message.trim() || undefined,
      });

      toast.success("Challenge sent!");
      resetForm();
      onChallengeCreated();
    } catch (error) {
      console.error("Failed to create challenge:", error);
      toast.error("Failed to send challenge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedBuddyId(preselectedBuddyId ?? null);
    setGameType("NASSAU");
    setBetAmount("20");
    setProposedDate("");
    setMessage("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Get tomorrow's date as minimum
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-lg">
          <SheetTitle>Send Challenge</SheetTitle>
        </SheetHeader>

        <div className="space-y-lg">
          {/* Select Opponent */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Opponent
            </label>
            {buddies.length > 0 ? (
              <div className="space-y-sm max-h-40 overflow-y-auto">
                {buddies.map((buddy) => {
                  const isSelected = selectedBuddyId === buddy.user.id;
                  return (
                    <button
                      key={buddy.id}
                      type="button"
                      onClick={() => setSelectedBuddyId(buddy.user.id)}
                      className={`w-full flex items-center gap-md p-md rounded-xl transition-colors ${
                        isSelected
                          ? "bg-brand/20 border border-brand/50"
                          : "glass-card hover:bg-white/5"
                      }`}
                    >
                      <Avatar
                        className="h-10 w-10"
                        src={buddy.user.avatarUrl}
                        name={buddy.nickname || buddy.user.displayName || buddy.user.firstName || "?"}
                      />
                      <span className="flex-1 text-left font-medium">
                        {buddy.nickname || buddy.user.displayName || buddy.user.firstName || "Unknown"}
                      </span>
                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted text-sm">
                No buddies to challenge. Add some buddies first!
              </p>
            )}
          </div>

          {/* Game Type */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Game Type
            </label>
            <div className="grid grid-cols-2 gap-sm">
              {ALL_GAME_TYPES.slice(0, 6).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGameType(type)}
                  className={`p-md rounded-xl text-sm font-medium transition-colors ${
                    gameType === type
                      ? "bg-brand/20 border border-brand/50 text-foreground"
                      : "glass-card hover:bg-white/5 text-muted"
                  }`}
                >
                  {formatGameType(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Bet Amount */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Bet Amount
            </label>
            <div className="relative">
              <DollarSign className="absolute left-md top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
              <input
                type="number"
                min="1"
                max="10000"
                step="5"
                placeholder="20"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full h-12 pl-12 pr-md rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
              />
            </div>
            <div className="flex gap-sm mt-sm">
              {[10, 20, 50, 100].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setBetAmount(amount.toString())}
                  className={`flex-1 py-sm rounded-lg text-sm font-medium transition-colors ${
                    betAmount === amount.toString()
                      ? "bg-brand/20 text-foreground"
                      : "bg-surface text-muted hover:bg-elevated"
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Proposed Date (optional) */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Proposed Date (optional)
            </label>
            <input
              type="date"
              min={minDate}
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              className="w-full h-12 px-md rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
            />
          </div>

          {/* Message (optional) */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Trash Talk (optional)
            </label>
            <textarea
              placeholder="Ready to lose again?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={200}
              className="w-full px-md py-sm rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedBuddyId || !betAmount}
          >
            {isSubmitting ? "Sending..." : "Send Challenge"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
