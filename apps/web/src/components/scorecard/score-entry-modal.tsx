"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Delete } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface ScoreEntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (score: number) => void;
  playerName: string;
  holeNumber: number;
  par: number;
  yardage?: number;
  handicapRank: number;
  currentScore?: number;
  strokesGiven?: number;
  isSaving?: boolean;
}

export function ScoreEntryModal({
  open,
  onClose,
  onSave,
  playerName,
  holeNumber,
  par,
  yardage,
  handicapRank,
  currentScore = 0,
  strokesGiven = 0,
  isSaving = false,
}: ScoreEntryModalProps) {
  const [score, setScore] = useState<string>(currentScore > 0 ? String(currentScore) : "");

  // Reset score when modal opens with new data
  useEffect(() => {
    if (open) {
      setScore(currentScore > 0 ? String(currentScore) : "");
    }
  }, [open, currentScore]);

  const handleNumberPress = useCallback((num: number) => {
    setScore((prev) => {
      // If empty or 0, replace with new number
      if (prev === "" || prev === "0") {
        return String(num);
      }
      // Limit to 2 digits (max score 99)
      if (prev.length >= 2) {
        return prev;
      }
      return prev + String(num);
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setScore((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setScore("");
  }, []);

  const handleQuickScore = useCallback((value: number) => {
    setScore(String(value));
  }, []);

  const handleSave = useCallback(() => {
    const numScore = parseInt(score, 10);
    if (!isNaN(numScore) && numScore >= 1 && numScore <= 20) {
      onSave(numScore);
    }
  }, [score, onSave]);

  const numericScore = parseInt(score, 10) || 0;
  const isValidScore = numericScore >= 1 && numericScore <= 20;
  const diff = numericScore - par;

  const getScoreLabel = () => {
    if (numericScore === 0) return "";
    if (diff <= -3) return "Albatross!";
    if (diff === -2) return "Eagle";
    if (diff === -1) return "Birdie";
    if (diff === 0) return "Par";
    if (diff === 1) return "Bogey";
    if (diff === 2) return "Double";
    if (diff === 3) return "Triple";
    return `+${diff}`;
  };

  const getScoreLabelColor = () => {
    if (numericScore === 0) return "text-muted";
    if (diff <= -2) return "text-brand font-bold";
    if (diff === -1) return "text-brand";
    if (diff === 0) return "text-foreground";
    if (diff === 1) return "text-amber-500";
    return "text-error";
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="max-h-[85vh]">
        <SheetHeader className="text-center pb-2">
          <SheetTitle className="flex items-center justify-center gap-2">
            <span>Hole {holeNumber}</span>
            <span className="text-muted font-normal">Par {par}</span>
          </SheetTitle>
          <div className="flex items-center justify-center gap-4 text-sm text-muted">
            {yardage && <span>{yardage} yds</span>}
            <span>HCP {handicapRank}</span>
            {strokesGiven > 0 && (
              <span className="flex items-center gap-1 text-brand">
                {Array.from({ length: strokesGiven }).map((_, i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-brand" />
                ))}
                <span className="ml-1">stroke{strokesGiven > 1 ? "s" : ""}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-muted">{playerName}</p>
        </SheetHeader>

        <div className="px-4 pb-24 space-y-6">
          {/* Score display */}
          <div className="text-center py-4">
            <div className="relative">
              <span className="text-6xl font-bold tabular-nums">
                {score || "-"}
              </span>
              {numericScore > 0 && (
                <span className={cn("block text-lg mt-1", getScoreLabelColor())}>
                  {getScoreLabel()}
                </span>
              )}
            </div>
          </div>

          {/* Quick score buttons */}
          <div className="flex justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickScore(par - 1)}
              className="text-brand"
            >
              Birdie ({par - 1})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickScore(par)}
            >
              Par ({par})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickScore(par + 1)}
              className="text-amber-500"
            >
              Bogey ({par + 1})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickScore(par + 2)}
              className="text-error"
            >
              Dbl ({par + 2})
            </Button>
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberPress(num)}
                className="h-14 rounded-xl bg-surface text-xl font-semibold hover:bg-elevated active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-14 rounded-xl bg-surface text-muted hover:bg-elevated active:scale-95 transition-all flex items-center justify-center"
            >
              <X className="h-6 w-6" />
            </button>
            <button
              onClick={() => handleNumberPress(0)}
              className="h-14 rounded-xl bg-surface text-xl font-semibold hover:bg-elevated active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="h-14 rounded-xl bg-surface text-muted hover:bg-elevated active:scale-95 transition-all flex items-center justify-center"
            >
              <Delete className="h-6 w-6" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={!isValidScore || isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
