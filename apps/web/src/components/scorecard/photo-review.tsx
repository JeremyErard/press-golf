"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, AlertTriangle, Loader2, X, Camera } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Input,
} from "@/components/ui";
import { ImageCapture } from "@/components/image-capture";
import { api, type ScorecardExtraction } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScorecardPhotoReviewProps {
  roundId: string;
  holeCount?: number;
  onScoresSaved: (scores: { holeNumber: number; strokes: number }[]) => void;
  onClose: () => void;
  open: boolean;
}

type Step = "capture" | "extracting" | "review" | "saving";

export function ScorecardPhotoReview({
  roundId,
  holeCount = 18,
  onScoresSaved,
  onClose,
  open,
}: ScorecardPhotoReviewProps) {
  const { getToken } = useAuth();
  const [step, setStep] = useState<Step>("capture");
  const [extraction, setExtraction] = useState<ScorecardExtraction | null>(null);
  const [editedScores, setEditedScores] = useState<{ holeNumber: number; strokes: number; confidence: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelected = useCallback(async (file: File) => {
    setStep("extracting");
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const result = await api.uploadScorecardPhoto(token, roundId, file);
      setExtraction(result);
      setEditedScores(result.extractedScores.map(s => ({ ...s })));
      setStep("review");
    } catch (err) {
      console.error("Failed to extract scores:", err);
      setError(err instanceof Error ? err.message : "Failed to extract scores from image");
      setStep("capture");
    }
  }, [getToken, roundId]);

  const handleScoreChange = useCallback((holeNumber: number, value: string) => {
    const strokes = parseInt(value, 10);
    if (isNaN(strokes) || strokes < 1 || strokes > 20) return;

    setEditedScores(prev =>
      prev.map(s =>
        s.holeNumber === holeNumber
          ? { ...s, strokes, confidence: "high" }
          : s
      )
    );
  }, []);

  const handleConfirm = useCallback(async () => {
    if (editedScores.length === 0) return;

    setStep("saving");
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const scores = editedScores.map(({ holeNumber, strokes }) => ({ holeNumber, strokes }));
      await api.confirmScorecardScores(token, roundId, scores);

      toast.success(`Saved ${scores.length} scores!`);
      onScoresSaved(scores);
      handleClose();
    } catch (err) {
      console.error("Failed to save scores:", err);
      setError(err instanceof Error ? err.message : "Failed to save scores");
      setStep("review");
    }
  }, [getToken, roundId, editedScores, onScoresSaved]);

  const handleClose = useCallback(() => {
    setStep("capture");
    setExtraction(null);
    setEditedScores([]);
    setError(null);
    onClose();
  }, [onClose]);

  const handleRetake = useCallback(() => {
    setStep("capture");
    setExtraction(null);
    setEditedScores([]);
    setError(null);
  }, []);

  // Group scores into front 9 and back 9
  const frontNine = editedScores.filter(s => s.holeNumber <= 9);
  const backNine = editedScores.filter(s => s.holeNumber > 9);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {step === "capture" && "Scan Scorecard"}
            {step === "extracting" && "Extracting Scores..."}
            {step === "review" && "Review Scores"}
            {step === "saving" && "Saving..."}
          </SheetTitle>
          <SheetDescription>
            {step === "capture" && "Take a photo of your physical scorecard"}
            {step === "extracting" && "AI is reading your scorecard"}
            {step === "review" && (extraction?.needsReview
              ? "Some scores need verification"
              : "Confirm the extracted scores"
            )}
            {step === "saving" && "Saving your scores"}
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-lg">
          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* Capture Step */}
          {step === "capture" && (
            <ImageCapture
              capture="environment"
              onImageSelected={handleImageSelected}
              showPreview={false}
              cameraLabel="Take Photo"
              galleryLabel="Choose from Library"
            />
          )}

          {/* Extracting Step */}
          {step === "extracting" && (
            <div className="py-xl text-center">
              <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto mb-lg" />
              <p className="text-muted">Reading your scorecard...</p>
            </div>
          )}

          {/* Review Step */}
          {step === "review" && extraction && (
            <>
              {/* Scorecard image preview */}
              {extraction.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={extraction.imageUrl}
                    alt="Scorecard"
                    className="w-full h-32 object-cover"
                  />
                </div>
              )}

              {/* Player name if detected */}
              {extraction.playerName && (
                <p className="text-center text-muted text-sm">
                  Player: {extraction.playerName}
                </p>
              )}

              {/* Scores grid */}
              <div className="space-y-md">
                {/* Front 9 */}
                {frontNine.length > 0 && (
                  <div>
                    <p className="text-caption text-muted mb-sm">Front 9</p>
                    <div className="grid grid-cols-9 gap-1">
                      {/* Hole numbers */}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(hole => (
                        <div key={`hole-${hole}`} className="text-center">
                          <span className="text-label text-muted">{hole}</span>
                        </div>
                      ))}
                      {/* Scores */}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(hole => {
                        const score = frontNine.find(s => s.holeNumber === hole);
                        return (
                          <input
                            key={`score-${hole}`}
                            type="number"
                            min="1"
                            max="20"
                            value={score?.strokes || ""}
                            onChange={(e) => handleScoreChange(hole, e.target.value)}
                            className={cn(
                              "w-full h-10 text-center rounded border text-body font-medium",
                              "bg-surface focus:outline-none focus:ring-2 focus:ring-brand",
                              score?.confidence === "low"
                                ? "border-warning bg-warning/10"
                                : score?.confidence === "medium"
                                ? "border-amber-500/50"
                                : "border-border"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Back 9 */}
                {backNine.length > 0 && holeCount > 9 && (
                  <div>
                    <p className="text-caption text-muted mb-sm">Back 9</p>
                    <div className="grid grid-cols-9 gap-1">
                      {/* Hole numbers */}
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(hole => (
                        <div key={`hole-${hole}`} className="text-center">
                          <span className="text-label text-muted">{hole}</span>
                        </div>
                      ))}
                      {/* Scores */}
                      {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(hole => {
                        const score = backNine.find(s => s.holeNumber === hole);
                        return (
                          <input
                            key={`score-${hole}`}
                            type="number"
                            min="1"
                            max="20"
                            value={score?.strokes || ""}
                            onChange={(e) => handleScoreChange(hole, e.target.value)}
                            className={cn(
                              "w-full h-10 text-center rounded border text-body font-medium",
                              "bg-surface focus:outline-none focus:ring-2 focus:ring-brand",
                              score?.confidence === "low"
                                ? "border-warning bg-warning/10"
                                : score?.confidence === "medium"
                                ? "border-amber-500/50"
                                : "border-border"
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Legend */}
                {extraction.needsReview && (
                  <div className="flex items-center gap-sm text-caption text-muted">
                    <div className="w-4 h-4 rounded border-2 border-warning bg-warning/10" />
                    <span>Needs verification</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-sm pt-md">
                <Button
                  onClick={handleConfirm}
                  className="w-full"
                  disabled={editedScores.length === 0}
                >
                  <Check className="h-5 w-5 mr-2" />
                  Confirm {editedScores.length} Scores
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleRetake}
                  className="w-full"
                >
                  <Camera className="h-5 w-5 mr-2" />
                  Retake Photo
                </Button>
              </div>
            </>
          )}

          {/* Saving Step */}
          {step === "saving" && (
            <div className="py-xl text-center">
              <Loader2 className="h-12 w-12 animate-spin text-brand mx-auto mb-lg" />
              <p className="text-muted">Saving your scores...</p>
            </div>
          )}

          {/* Cancel button */}
          {(step === "capture" || step === "review") && (
            <Button
              variant="ghost"
              onClick={handleClose}
              className="w-full text-muted"
            >
              Cancel
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
