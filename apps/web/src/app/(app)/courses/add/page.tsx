"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2, Check, Link as LinkIcon, Loader2, AlertCircle, Sparkles } from "lucide-react";
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

type EntryMode = "choose" | "url" | "manual";
type Step = "info" | "holes" | "tees" | "review";

export default function AddCoursePage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [entryMode, setEntryMode] = useState<EntryMode>("choose");
  const [step, setStep] = useState<Step>("info");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // URL entry
  const [url, setUrl] = useState("");

  // Course info
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [_website, setWebsite] = useState("");

  // Holes
  const [holes, setHoles] = useState<HoleData[]>(defaultHoles);

  // Tees
  const [tees, setTees] = useState<TeeData[]>(defaultTees);

  const handleFetchFromUrl = async () => {
    if (!url.trim()) return;

    setIsFetching(true);
    setFetchError(null);

    try {
      const token = await getToken();
      if (!token) {
        setFetchError("Not authenticated. Please sign in again.");
        setIsFetching(false);
        return;
      }

      console.log("Fetching course from URL:", url.trim());
      const data = await api.fetchCourseFromUrl(token, url.trim());
      console.log("Fetched course data:", data);

      // Populate form with scraped data
      if (data.name) setName(data.name);
      if (data.city) setCity(data.city);
      if (data.state) setState(data.state);
      if (data.website) setWebsite(data.website);

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

      // Move to review step to show scraped data
      setStep("review");
    } catch (error) {
      setFetchError(String(error) || "Failed to fetch course data");
    } finally {
      setIsFetching(false);
    }
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
        {/* Entry Mode Selection */}
        {entryMode === "choose" && (
          <div className="space-y-lg">
            <p className="text-center text-muted">How would you like to add a course?</p>

            <Card
              className="cursor-pointer hover:border-brand transition-colors"
              onClick={() => setEntryMode("url")}
            >
              <CardContent className="p-lg">
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-brand" />
                  </div>
                  <div className="flex-1">
                    <p className="text-body font-semibold">Import from URL</p>
                    <p className="text-caption text-muted">
                      Paste a course website link and we will extract the data automatically
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-brand transition-colors"
              onClick={() => {
                setEntryMode("manual");
                setStep("info");
              }}
            >
              <CardContent className="p-lg">
                <div className="flex items-center gap-md">
                  <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
                    <Plus className="h-6 w-6 text-muted" />
                  </div>
                  <div className="flex-1">
                    <p className="text-body font-semibold">Enter Manually</p>
                    <p className="text-caption text-muted">
                      Add course details, pars, and tees by hand
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* URL Entry */}
        {entryMode === "url" && step === "info" && (
          <div className="space-y-lg">
            <Card>
              <CardContent className="p-lg space-y-lg">
                <div className="flex items-center gap-sm mb-md">
                  <Sparkles className="h-5 w-5 text-brand" />
                  <p className="text-body font-medium">Import from Website</p>
                </div>

                <div className="relative">
                  <LinkIcon className="absolute left-md top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                  <input
                    type="url"
                    placeholder="https://example-golf-club.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full h-12 pl-12 pr-md rounded-md border border-border bg-surface text-body text-foreground placeholder:text-subtle focus-ring"
                  />
                </div>

                <p className="text-caption text-muted">
                  Paste the URL of the golf course's website. We will try to find the scorecard and extract course data automatically.
                </p>

                {fetchError && (
                  <div className="flex items-start gap-sm p-md rounded-lg bg-error/10 border border-error/20">
                    <AlertCircle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-caption text-error font-medium">Import Failed</p>
                      <p className="text-caption text-error/80">{fetchError}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-md">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setEntryMode("choose")}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleFetchFromUrl}
                disabled={!url.trim() || isFetching}
              >
                {isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Import Course
                  </>
                )}
              </Button>
            </div>

            <button
              className="w-full text-center text-caption text-muted hover:text-foreground transition-colors"
              onClick={() => {
                setEntryMode("manual");
                setStep("info");
              }}
            >
              Or enter details manually
            </button>
          </div>
        )}

        {/* Review Scraped Data */}
        {step === "review" && (
          <div className="space-y-lg">
            <div className="flex items-center gap-sm">
              <Check className="h-5 w-5 text-success" />
              <p className="text-body font-medium">Course Data Imported</p>
            </div>

            <Card>
              <CardContent className="p-lg space-y-md">
                <div>
                  <p className="text-caption text-muted">Course Name</p>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Course name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <p className="text-caption text-muted">City</p>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <p className="text-caption text-muted">State</p>
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
                  <Badge variant="brand">Par {getTotalPar()}</Badge>
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

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-md"
                  onClick={() => setStep("holes")}
                >
                  Edit Pars
                </Button>
              </CardContent>
            </Card>

            {/* Tees Summary */}
            <Card>
              <CardContent className="p-lg">
                <p className="text-body font-medium mb-md">Tees</p>

                <div className="space-y-sm">
                  {tees.map((tee, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-sm">
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: tee.color }}
                        />
                        <span className="text-body">{tee.name}</span>
                      </div>
                      <div className="flex items-center gap-md text-caption text-muted">
                        <span>Slope: {tee.slopeRating}</span>
                        <span>Rating: {tee.courseRating}</span>
                        {tee.totalYardage && <span>{tee.totalYardage} yds</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-md"
                  onClick={() => setStep("tees")}
                >
                  Edit Tees
                </Button>
              </CardContent>
            </Card>

            <div className="flex gap-md">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setStep("info");
                  setEntryMode("url");
                }}
              >
                Back
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

        {/* Manual Entry - Step Indicator */}
        {entryMode === "manual" && step !== "review" && (
          <>
            <div className="flex items-center gap-sm justify-center">
              {["info", "holes", "tees"].map((s, i) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-label font-semibold ${
                      step === s
                        ? "bg-brand text-white"
                        : i < ["info", "holes", "tees"].indexOf(step)
                        ? "bg-success text-white"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {i < ["info", "holes", "tees"].indexOf(step) ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 2 && (
                    <div
                      className={`w-8 h-0.5 ${
                        i < ["info", "holes", "tees"].indexOf(step)
                          ? "bg-success"
                          : "bg-border"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step: Course Info (Manual) */}
        {entryMode === "manual" && step === "info" && (
          <div className="space-y-lg">
            <Card>
              <CardContent className="p-lg space-y-lg">
                <Input
                  label="Course Name"
                  placeholder="e.g., Augusta National"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-md">
                  <Input
                    label="City"
                    placeholder="e.g., Augusta"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <Input
                    label="State"
                    placeholder="e.g., GA"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-md">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setEntryMode("choose")}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("holes")}
                disabled={!name.trim()}
              >
                Next: Set Pars
              </Button>
            </div>
          </div>
        )}

        {/* Step: Holes */}
        {step === "holes" && (
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

            <div className="flex gap-md">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => entryMode === "manual" ? setStep("info") : setStep("review")}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => entryMode === "manual" ? setStep("tees") : setStep("review")}
              >
                {entryMode === "manual" ? "Next: Add Tees" : "Done"}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Tees */}
        {step === "tees" && (
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
                        "#3B82F6", // Blue
                        "#FFFFFF", // White
                        "#EAB308", // Gold
                        "#EF4444", // Red
                        "#22C55E", // Green
                        "#000000", // Black
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

            <div className="flex gap-md">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => entryMode === "manual" ? setStep("holes") : setStep("review")}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={entryMode === "manual" ? handleSubmit : () => setStep("review")}
                isLoading={isSubmitting}
              >
                <Check className="h-4 w-4 mr-2" />
                {entryMode === "manual" ? "Create Course" : "Done"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
