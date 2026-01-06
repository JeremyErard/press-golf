"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Camera, Upload, PenLine, Check, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { api, HandicapSource } from "@/lib/api";

type Step = "choice" | "upload" | "manual" | "confirm" | "success";

interface ExtractedData {
  handicapIndex: number;
  source: HandicapSource;
  confidence: "high" | "medium" | "low";
  proofUrl?: string | null;
}

export default function HandicapOnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("choice");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [manualHandicap, setManualHandicap] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
    setStep("upload");
  };

  const handleExtract = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const data = await api.extractHandicap(token, selectedFile);
      setExtractedData(data);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract handicap from image");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVerified = async () => {
    if (!extractedData) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await api.verifyHandicap(
        token,
        extractedData.handicapIndex,
        extractedData.source,
        extractedData.proofUrl
      );
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save handicap");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitManual = async () => {
    const handicap = parseFloat(manualHandicap);
    if (isNaN(handicap) || handicap < -10 || handicap > 54) {
      setError("Please enter a valid handicap between -10 and 54");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await api.submitManualHandicap(token, handicap);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save handicap");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push("/");
  };

  const handleBack = () => {
    setError(null);
    if (step === "upload" || step === "manual") {
      setStep("choice");
      setSelectedFile(null);
      setPreviewUrl(null);
    } else if (step === "confirm") {
      setStep("upload");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="mb-8">
          {step !== "choice" && step !== "success" && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-muted hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {step === "success" ? "You're all set!" : "Set Your Handicap"}
          </h1>
          <p className="text-muted mt-2">
            {step === "choice" && "Your handicap is used to calculate strokes in games."}
            {step === "upload" && "Upload a screenshot from your handicap system."}
            {step === "manual" && "Enter your handicap manually."}
            {step === "confirm" && "Confirm your extracted handicap."}
            {step === "success" && "Your handicap has been saved."}
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Choice Step */}
        {step === "choice" && (
          <div className="space-y-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-6 rounded-2xl bg-card border border-border hover:border-brand/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors">
                  <Camera className="w-7 h-7 text-brand" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">Upload Screenshot</h3>
                  <p className="text-sm text-muted mt-1">
                    Take a photo of your GHIN app or handicap card
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep("manual")}
              className="w-full p-6 rounded-2xl bg-card border border-border hover:border-brand/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  <PenLine className="w-7 h-7 text-amber-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">Enter Manually</h3>
                  <p className="text-sm text-muted mt-1">
                    Type your handicap (requires approval)
                  </p>
                </div>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={handleContinue}
              className="w-full mt-6 py-3 text-muted hover:text-foreground transition-colors text-sm"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Upload Step */}
        {step === "upload" && previewUrl && (
          <div className="space-y-6">
            <div className="rounded-2xl overflow-hidden border border-border">
              <img
                src={previewUrl}
                alt="Handicap screenshot"
                className="w-full object-contain max-h-64"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 px-4 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-card-hover transition-colors"
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Change
              </button>
              <button
                onClick={handleExtract}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  "Extract Handicap"
                )}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Manual Entry Step */}
        {step === "manual" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-amber-400 text-sm">
                Manual handicaps require approval from the round creator before you can play in games.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Handicap Index
              </label>
              <input
                type="number"
                step="0.1"
                min="-10"
                max="54"
                value={manualHandicap}
                onChange={(e) => setManualHandicap(e.target.value)}
                placeholder="e.g., 12.5"
                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-brand"
              />
              <p className="text-xs text-muted mt-2">
                Enter a value between -10.0 and 54.0
              </p>
            </div>

            <button
              onClick={handleSubmitManual}
              disabled={loading || !manualHandicap}
              className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Handicap"
              )}
            </button>
          </div>
        )}

        {/* Confirm Step */}
        {step === "confirm" && extractedData && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border text-center">
              <div className="text-5xl font-bold text-brand mb-2">
                {extractedData.handicapIndex.toFixed(1)}
              </div>
              <p className="text-muted">
                Extracted from {extractedData.source}
              </p>
              {extractedData.confidence !== "high" && (
                <p className="text-amber-400 text-sm mt-2">
                  Confidence: {extractedData.confidence}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep("upload");
                  setExtractedData(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-card-hover transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleConfirmVerified}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 inline mr-2" />
                    Confirm
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setStep("manual")}
              className="w-full py-2 text-muted hover:text-foreground transition-colors text-sm"
            >
              Enter different handicap manually
            </button>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mx-auto">
              <Check className="w-10 h-10 text-brand" />
            </div>

            <div>
              {extractedData ? (
                <>
                  <p className="text-muted mb-2">Your verified handicap</p>
                  <div className="text-5xl font-bold text-brand">
                    {extractedData.handicapIndex.toFixed(1)}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted mb-2">Your handicap</p>
                  <div className="text-5xl font-bold text-brand">
                    {parseFloat(manualHandicap).toFixed(1)}
                  </div>
                  <p className="text-amber-400 text-sm mt-2">
                    Pending approval from round creators
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleContinue}
              className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-medium transition-colors"
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
