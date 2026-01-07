"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Camera, Link as LinkIcon, Loader2, AlertCircle, Check, Edit3, Trash2, Plus, ImagePlus, ArrowRight, RotateCcw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, Card, CardContent, Input, Badge } from "@/components/ui";
import { api } from "@/lib/api";

interface HoleData {
  holeNumber: number;
  par: number;
  handicapRank: number;
  yardages?: { teeName: string; yardage: number }[];
}

interface TeeData {
  name: string;
  color: string;
  slopeRating: number;
  courseRating: number;
  totalYardage?: number;
}

const defaultHoles: HoleData[] = Array.from({ length: 18 }, (_, i) => ({
  holeNumber: i + 1,
  par: 4,
  handicapRank: i + 1,
}));

const defaultTees: TeeData[] = [
  { name: "Blue", color: "#3B82F6", slopeRating: 130, courseRating: 72.0 },
  { name: "White", color: "#FFFFFF", slopeRating: 125, courseRating: 70.5 },
];

type Step = "choose" | "capture-front" | "capture-back" | "extracting" | "review" | "edit-holes" | "edit-tees";

export default function AddCoursePage() {
  const router = useRouter();
  const { getToken } = useAuth();

  // Separate refs for camera and gallery file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("choose");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Two-sided scorecard capture state
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [captureSide, setCaptureSide] = useState<"front" | "back">("front");

  // Course data
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [holes, setHoles] = useState<HoleData[]>(defaultHoles);
  const [tees, setTees] = useState<TeeData[]>(defaultTees);
  const [confidence, setConfidence] = useState<string | null>(null);

  // URL entry
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    e.target.value = "";

    if (captureSide === "front") {
      // Capture front image
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontImage(file);
      setFrontPreview(URL.createObjectURL(file));
      setStep("capture-front");
    } else {
      // Capture back image
      if (backPreview) URL.revokeObjectURL(backPreview);
      setBackImage(file);
      setBackPreview(URL.createObjectURL(file));
      setStep("capture-back");
    }
  };

  const handleExtractScorecard = async () => {
    if (!frontImage) return;

    setStep("extracting");
    setExtractError(null);

    try {
      const token = await getToken();
      if (!token) {
        setExtractError("Not authenticated. Please sign in again.");
        setStep("choose");
        return;
      }

      const data = await api.extractCourseFromImage(token, frontImage, backImage || undefined);

      // Populate form with extracted data
      if (data.name) setName(data.name);
      if (data.city) setCity(data.city);
      if (data.state) setState(data.state);
      if (data.confidence) setConfidence(data.confidence);

      if (data.tees && data.tees.length > 0) {
        setTees(data.tees.map(t => ({
          name: t.name,
          color: t.color || "#3B82F6",
          slopeRating: t.slopeRating || 120,
          courseRating: t.courseRating || 70,
          totalYardage: t.totalYardage,
        })));
      }

      if (data.holes && data.holes.length > 0) {
        setHoles(data.holes.map(h => ({
          holeNumber: h.holeNumber,
          par: h.par,
          handicapRank: h.handicapRank,
          yardages: h.yardages,
        })));
      }

      setStep("review");
    } catch (error) {
      setExtractError(String(error) || "Failed to extract scorecard data");
      setStep("capture-front");
    }
  };

  const startCapture = () => {
    setCaptureSide("front");
    setFrontImage(null);
    setBackImage(null);
    setFrontPreview(null);
    setBackPreview(null);
    setStep("capture-front");
  };

  const handleFetchFromUrl = async () => {
    if (!url.trim()) return;

    setIsFetchingUrl(true);
    setExtractError(null);

    try {
      const token = await getToken();
      if (!token) {
        setExtractError("Not authenticated. Please sign in again.");
        setIsFetchingUrl(false);
        return;
      }

      const data = await api.fetchCourseFromUrl(token, url.trim());

      if (data.name) setName(data.name);
      if (data.city) setCity(data.city);
      if (data.state) setState(data.state);

      if (data.tees && data.tees.length > 0) {
        setTees(data.tees.map(t => ({
          name: t.name,
          color: t.color || "#3B82F6",
          slopeRating: t.slopeRating || 120,
          courseRating: t.courseRating || 70,
          totalYardage: t.totalYardage,
        })));
      }

      if (data.holes && data.holes.length > 0) {
        setHoles(data.holes.map(h => ({
          holeNumber: h.holeNumber,
          par: h.par,
          handicapRank: h.handicapRank,
          yardages: h.yardages,
        })));
      }

      setStep("review");
    } catch (error) {
      setExtractError(String(error) || "Failed to fetch course data");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleManualEntry = () => {
    setName("");
    setCity("");
    setState("");
    setHoles(defaultHoles);
    setTees(defaultTees);
    setConfidence(null);
    setStep("review");
  };

  const updateHolePar = (holeNumber: number, par: number) => {
    setHoles((prev) =>
      prev.map((h) => (h.holeNumber === holeNumber ? { ...h, par } : h))
    );
  };

  const addTee = () => {
    setTees([
      ...tees,
      { name: "", color: "#10B981", slopeRating: 120, courseRating: 70.0 },
    ]);
  };

  const removeTee = (index: number) => {
    setTees(tees.filter((_, i) => i !== index));
  };

  const updateTee = (index: number, field: keyof TeeData, value: string | number) => {
    setTees((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.createCourse(token, {
        name: name.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        holes: holes.map((h) => ({
          holeNumber: h.holeNumber,
          par: h.par,
          handicapRank: h.handicapRank,
          yardages: h.yardages,
        })),
        tees: tees
          .filter((t) => t.name.trim())
          .map((t) => ({
            name: t.name.trim(),
            color: t.color,
            slopeRating: t.slopeRating,
            courseRating: t.courseRating,
            totalYardage: t.totalYardage,
          })),
      });

      router.push("/courses");
    } catch (error) {
      console.error("Failed to create course:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTotalPar = () => holes.reduce((sum, h) => sum + h.par, 0);

  return (
    <div>
      <Header title="Add Course" showBack />

      <div className="p-lg space-y-lg">
        {/* Hidden file inputs for camera and gallery */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Step: Choose Method */}
        {step === "choose" && (
          <div className="space-y-lg">
            {extractError && (
              <div className="flex items-start gap-sm p-md rounded-lg bg-error/10 border border-error/20">
                <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-caption text-error font-medium">Extraction Failed</p>
                  <p className="text-caption text-error/80">{extractError}</p>
                </div>
              </div>
            )}

            {/* Primary: Photo */}
            <Card
              className="cursor-pointer hover:border-brand transition-colors border-2 border-brand/50"
              onClick={startCapture}
            >
              <CardContent className="p-xl text-center">
                <div className="w-16 h-16 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-md">
                  <Camera className="h-8 w-8 text-brand" />
                </div>
                <p className="text-h3 font-semibold mb-xs">Take Photo of Scorecard</p>
                <p className="text-caption text-muted">
                  Capture front and back like a mobile check deposit
                </p>
                <Badge variant="brand" className="mt-md">Recommended</Badge>
              </CardContent>
            </Card>

            {/* Secondary: URL */}
            {!showUrlInput ? (
              <button
                onClick={() => setShowUrlInput(true)}
                className="w-full text-center text-caption text-muted hover:text-foreground transition-colors py-sm"
              >
                Or import from website URL
              </button>
            ) : (
              <Card>
                <CardContent className="p-lg space-y-md">
                  <div className="flex items-center gap-sm">
                    <LinkIcon className="h-5 w-5 text-muted" />
                    <p className="text-body font-medium">Import from URL</p>
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://example-golf-club.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full h-12 px-md rounded-md border border-border bg-surface text-body text-foreground placeholder:text-subtle focus-ring"
                    />
                  </div>
                  <div className="flex gap-sm">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowUrlInput(false);
                        setUrl("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleFetchFromUrl}
                      disabled={!url.trim() || isFetchingUrl}
                      className="flex-1"
                    >
                      {isFetchingUrl ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tertiary: Manual */}
            <button
              onClick={handleManualEntry}
              className="w-full text-center text-caption text-muted hover:text-foreground transition-colors py-sm"
            >
              Enter details manually
            </button>
          </div>
        )}

        {/* Step: Capture Front */}
        {step === "capture-front" && (
          <div className="space-y-lg">
            <div className="text-center">
              <p className="text-caption text-muted mb-xs">Step 1 of 2</p>
              <p className="text-h3 font-semibold">Front of Scorecard</p>
              <p className="text-caption text-muted mt-xs">
                Capture the side with hole numbers, pars, and yardages
              </p>
            </div>

            {frontPreview ? (
              <div className="space-y-md">
                <div className="rounded-2xl overflow-hidden border border-border">
                  <img
                    src={frontPreview}
                    alt="Front of scorecard"
                    className="w-full object-contain max-h-64"
                  />
                </div>
                <div className="flex gap-sm">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setCaptureSide("front");
                      galleryInputRef.current?.click();
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retake
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setCaptureSide("back");
                      setStep("capture-back");
                    }}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-md">
                <Card
                  className="cursor-pointer hover:border-brand transition-colors"
                  onClick={() => {
                    setCaptureSide("front");
                    cameraInputRef.current?.click();
                  }}
                >
                  <CardContent className="p-lg text-center">
                    <div className="w-14 h-14 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-md">
                      <Camera className="h-7 w-7 text-brand" />
                    </div>
                    <p className="text-body font-semibold">Take Photo</p>
                  </CardContent>
                </Card>

                <button
                  onClick={() => {
                    setCaptureSide("front");
                    galleryInputRef.current?.click();
                  }}
                  className="w-full flex items-center justify-center gap-sm text-caption text-muted hover:text-foreground transition-colors py-sm"
                >
                  <ImagePlus className="h-4 w-4" />
                  Choose from Library
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setStep("choose");
                setFrontImage(null);
                setFrontPreview(null);
              }}
              className="w-full text-center text-caption text-muted hover:text-foreground transition-colors py-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Step: Capture Back */}
        {step === "capture-back" && (
          <div className="space-y-lg">
            <div className="text-center">
              <p className="text-caption text-muted mb-xs">Step 2 of 2</p>
              <p className="text-h3 font-semibold">Back of Scorecard</p>
              <p className="text-caption text-muted mt-xs">
                Capture the side with course name, address, and website
              </p>
            </div>

            {backPreview ? (
              <div className="space-y-md">
                <div className="rounded-2xl overflow-hidden border border-border">
                  <img
                    src={backPreview}
                    alt="Back of scorecard"
                    className="w-full object-contain max-h-64"
                  />
                </div>
                <div className="flex gap-sm">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setCaptureSide("back");
                      galleryInputRef.current?.click();
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retake
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleExtractScorecard}
                  >
                    Extract Data
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-md">
                <Card
                  className="cursor-pointer hover:border-brand transition-colors"
                  onClick={() => {
                    setCaptureSide("back");
                    cameraInputRef.current?.click();
                  }}
                >
                  <CardContent className="p-lg text-center">
                    <div className="w-14 h-14 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-md">
                      <Camera className="h-7 w-7 text-brand" />
                    </div>
                    <p className="text-body font-semibold">Take Photo</p>
                  </CardContent>
                </Card>

                <button
                  onClick={() => {
                    setCaptureSide("back");
                    galleryInputRef.current?.click();
                  }}
                  className="w-full flex items-center justify-center gap-sm text-caption text-muted hover:text-foreground transition-colors py-sm"
                >
                  <ImagePlus className="h-4 w-4" />
                  Choose from Library
                </button>
              </div>
            )}

            <div className="flex gap-md">
              <button
                onClick={() => setStep("capture-front")}
                className="flex-1 text-center text-caption text-muted hover:text-foreground transition-colors py-sm"
              >
                ← Back to Front
              </button>
              <button
                onClick={handleExtractScorecard}
                className="flex-1 text-center text-caption text-brand hover:text-brand-dark transition-colors py-sm"
              >
                Skip Back Photo →
              </button>
            </div>
          </div>
        )}

        {/* Step: Extracting */}
        {step === "extracting" && (
          <div className="text-center py-xl">
            <Loader2 className="h-12 w-12 text-brand animate-spin mx-auto mb-lg" />
            <p className="text-h3 font-semibold mb-xs">Reading Scorecard...</p>
            <p className="text-caption text-muted">
              Extracting course data from your photo
            </p>
          </div>
        )}

        {/* Step: Review */}
        {step === "review" && (
          <div className="space-y-lg">
            {confidence && (
              <div className="flex items-center gap-sm">
                <Check className="h-5 w-5 text-success" />
                <p className="text-body font-medium">
                  Scorecard Extracted
                  {confidence === "high" && " (High Confidence)"}
                  {confidence === "medium" && " (Medium Confidence)"}
                  {confidence === "low" && " (Low Confidence - Please Review)"}
                </p>
              </div>
            )}

            {/* Course Info */}
            <Card>
              <CardContent className="p-lg space-y-md">
                <div>
                  <p className="text-caption text-muted mb-xs">Course Name *</p>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter course name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <p className="text-caption text-muted mb-xs">City</p>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <p className="text-caption text-muted mb-xs">State</p>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Holes Summary */}
            <Card>
              <CardContent className="p-lg">
                <div className="flex items-center justify-between mb-md">
                  <p className="text-body font-medium">Holes</p>
                  <div className="flex items-center gap-sm">
                    <Badge variant="brand">Par {getTotalPar()}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("edit-holes")}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-9 gap-1 mb-md">
                  {holes.slice(0, 9).map((hole) => (
                    <div key={hole.holeNumber} className="text-center">
                      <p className="text-[10px] text-muted">{hole.holeNumber}</p>
                      <p className="text-caption font-medium">{hole.par}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-9 gap-1">
                  {holes.slice(9, 18).map((hole) => (
                    <div key={hole.holeNumber} className="text-center">
                      <p className="text-[10px] text-muted">{hole.holeNumber}</p>
                      <p className="text-caption font-medium">{hole.par}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tees Summary */}
            <Card>
              <CardContent className="p-lg">
                <div className="flex items-center justify-between mb-md">
                  <p className="text-body font-medium">Tees</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("edit-tees")}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-sm">
                  {tees.map((tee, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-sm">
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: tee.color }}
                        />
                        <span className="text-body">{tee.name || "Unnamed"}</span>
                      </div>
                      <div className="flex items-center gap-md text-caption text-muted">
                        <span>Slope: {tee.slopeRating}</span>
                        <span>Rating: {tee.courseRating}</span>
                        {tee.totalYardage && <span>{tee.totalYardage} yds</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-md">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setStep("choose");
                  setConfidence(null);
                }}
              >
                Start Over
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                disabled={!name.trim()}
              >
                <Check className="h-4 w-4 mr-2" />
                Create Course
              </Button>
            </div>
          </div>
        )}

        {/* Step: Edit Holes */}
        {step === "edit-holes" && (
          <div className="space-y-lg">
            <Card>
              <CardContent className="p-lg">
                <h3 className="text-h3 font-semibold mb-md">Front Nine</h3>
                <div className="grid grid-cols-3 gap-md">
                  {holes.slice(0, 9).map((hole) => (
                    <div key={hole.holeNumber} className="text-center">
                      <p className="text-caption text-muted mb-xs">
                        Hole {hole.holeNumber}
                      </p>
                      <div className="flex items-center justify-center gap-xs">
                        {[3, 4, 5].map((par) => (
                          <button
                            key={par}
                            onClick={() => updateHolePar(hole.holeNumber, par)}
                            className={`w-8 h-8 rounded-md text-caption font-medium ${
                              hole.par === par
                                ? "bg-brand text-white"
                                : "bg-surface text-muted hover:bg-elevated"
                            }`}
                          >
                            {par}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-lg">
                <h3 className="text-h3 font-semibold mb-md">Back Nine</h3>
                <div className="grid grid-cols-3 gap-md">
                  {holes.slice(9, 18).map((hole) => (
                    <div key={hole.holeNumber} className="text-center">
                      <p className="text-caption text-muted mb-xs">
                        Hole {hole.holeNumber}
                      </p>
                      <div className="flex items-center justify-center gap-xs">
                        {[3, 4, 5].map((par) => (
                          <button
                            key={par}
                            onClick={() => updateHolePar(hole.holeNumber, par)}
                            className={`w-8 h-8 rounded-md text-caption font-medium ${
                              hole.par === par
                                ? "bg-brand text-white"
                                : "bg-surface text-muted hover:bg-elevated"
                            }`}
                          >
                            {par}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button className="w-full" onClick={() => setStep("review")}>
              <Check className="h-4 w-4 mr-2" />
              Done
            </Button>
          </div>
        )}

        {/* Step: Edit Tees */}
        {step === "edit-tees" && (
          <div className="space-y-lg">
            {tees.map((tee, index) => (
              <Card key={index}>
                <CardContent className="p-lg space-y-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-sm">
                      <div
                        className="w-6 h-6 rounded-full border-2 border-border"
                        style={{ backgroundColor: tee.color }}
                      />
                      <Input
                        placeholder="Tee name (e.g., Blue)"
                        value={tee.name}
                        onChange={(e) => updateTee(index, "name", e.target.value)}
                        className="w-32"
                      />
                    </div>
                    {tees.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeTee(index)}
                      >
                        <Trash2 className="h-4 w-4 text-error" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-md">
                    <Input
                      label="Slope Rating"
                      type="number"
                      value={tee.slopeRating}
                      onChange={(e) =>
                        updateTee(index, "slopeRating", parseInt(e.target.value) || 0)
                      }
                    />
                    <Input
                      label="Course Rating"
                      type="number"
                      step="0.1"
                      value={tee.courseRating}
                      onChange={(e) =>
                        updateTee(index, "courseRating", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>

                  {/* Color picker */}
                  <div>
                    <p className="text-caption text-muted mb-xs">Color</p>
                    <div className="flex gap-sm">
                      {[
                        "#000000", // Black
                        "#3B82F6", // Blue
                        "#FFFFFF", // White
                        "#EAB308", // Gold
                        "#EF4444", // Red
                        "#22C55E", // Green
                      ].map((color) => (
                        <button
                          key={color}
                          onClick={() => updateTee(index, "color", color)}
                          className={`w-8 h-8 rounded-full border-2 ${
                            tee.color === color
                              ? "border-brand"
                              : "border-border"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="secondary"
              className="w-full"
              onClick={addTee}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Tee
            </Button>

            <Button className="w-full" onClick={() => setStep("review")}>
              <Check className="h-4 w-4 mr-2" />
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
