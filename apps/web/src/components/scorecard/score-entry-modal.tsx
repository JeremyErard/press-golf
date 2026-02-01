"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Delete, Target, CircleDot } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DotsType } from "@/lib/api";

interface ScoreEntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (score: number, dots?: DotsType[]) => void;
  playerName: string;
  holeNumber: number;
  par: number;
  yardage?: number;
  handicapRank: number;
  currentScore?: number;
  strokesGiven?: number;
  isSaving?: boolean;
  // Dots (side bets) props
  dotsEnabled?: boolean;
  existingDots?: DotsType[];
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
  dotsEnabled = false,
  existingDots = [],
}: ScoreEntryModalProps) {
  const [score, setScore] = useState<string>(currentScore > 0 ? String(currentScore) : "");
  const [selectedDots, setSelectedDots] = useState<Set<DotsType>>(new Set(existingDots));

  // Reset score and dots when modal opens with new data
  useEffect(() => {
    if (open) {
      setScore(currentScore > 0 ? String(currentScore) : "");
      setSelectedDots(new Set(existingDots));
    }
  }, [open, currentScore, existingDots]);

  const toggleDot = useCallback((dotType: DotsType) => {
    setSelectedDots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dotType)) {
        newSet.delete(dotType);
      } else {
        newSet.add(dotType);
      }
      return newSet;
    });
  }, []);

  const isPar3 = par === 3;

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
    if (!isNaN(numScore) && numScore >= 1 && numScore <= 15) {
      const dotsArray = Array.from(selectedDots);
      onSave(numScore, dotsArray.length > 0 ? dotsArray : undefined);
    }
  }, [score, selectedDots, onSave]);

  const numericScore = parseInt(score, 10) || 0;
  const isValidScore = numericScore >= 1 && numericScore <= 15;
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
      <SheetContent className="flex flex-col max-h-[80vh] overflow-hidden">
        <SheetHeader className="text-center pb-1 flex-shrink-0">
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

        <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-3">
          {/* Score display */}
          <div className="text-center py-2">
            <div className="relative">
              <span className="text-5xl font-bold tabular-nums">
                {score || "-"}
              </span>
              {numericScore > 0 && (
                <span className={cn("block text-lg mt-1", getScoreLabelColor())}>
                  {getScoreLabel()}
                </span>
              )}
            </div>
          </div>

          {/* Dots (side bets) */}
          {dotsEnabled && (
            <div className="px-2 py-2 rounded-xl bg-surface">
              <p className="text-xs text-muted text-center mb-2">DOTS</p>
              <div className="flex justify-center gap-2">
                {/* Greenie - only on par 3 */}
                <button
                  onClick={() => isPar3 && toggleDot("GREENIE")}
                  disabled={!isPar3}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all",
                    isPar3 ? "cursor-pointer" : "opacity-40 cursor-not-allowed",
                    selectedDots.has("GREENIE")
                      ? "bg-brand/20 ring-2 ring-brand"
                      : "bg-elevated hover:bg-elevated/80"
                  )}
                >
                  <Target className={cn("h-5 w-5", selectedDots.has("GREENIE") ? "text-brand" : "text-muted")} />
                  <span className={cn("text-xs", selectedDots.has("GREENIE") ? "text-brand font-medium" : "text-muted")}>
                    Greenie
                  </span>
                </button>

                {/* Sandy */}
                <button
                  onClick={() => toggleDot("SANDY")}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer",
                    selectedDots.has("SANDY")
                      ? "bg-amber-500/20 ring-2 ring-amber-500"
                      : "bg-elevated hover:bg-elevated/80"
                  )}
                >
                  <span className={cn("text-lg", selectedDots.has("SANDY") ? "" : "grayscale")}>🏖️</span>
                  <span className={cn("text-xs", selectedDots.has("SANDY") ? "text-amber-400 font-medium" : "text-muted")}>
                    Sandy
                  </span>
                </button>

                {/* Poley */}
                <button
                  onClick={() => toggleDot("POLEY")}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all cursor-pointer",
                    selectedDots.has("POLEY")
                      ? "bg-purple-500/20 ring-2 ring-purple-500"
                      : "bg-elevated hover:bg-elevated/80"
                  )}
                >
                  <CircleDot className={cn("h-5 w-5", selectedDots.has("POLEY") ? "text-purple-400" : "text-muted")} />
                  <span className={cn("text-xs", selectedDots.has("POLEY") ? "text-purple-400 font-medium" : "text-muted")}>
                    Poley
                  </span>
                </button>
              </div>
            </div>
          )}

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
          <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberPress(num)}
                className="h-11 rounded-xl bg-surface text-lg font-semibold hover:bg-elevated active:scale-95 transition-all"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="h-11 rounded-xl bg-surface text-muted hover:bg-elevated active:scale-95 transition-all flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={() => handleNumberPress(0)}
              className="h-11 rounded-xl bg-surface text-lg font-semibold hover:bg-elevated active:scale-95 transition-all"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="h-11 rounded-xl bg-surface text-muted hover:bg-elevated active:scale-95 transition-all flex items-center justify-center"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Action buttons - fixed at bottom */}
        <div className="flex gap-3 px-4 py-3 border-t border-border flex-shrink-0">
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
      </SheetContent>
    </Sheet>
  );
}
