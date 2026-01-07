"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ChevronRight, ChevronDown, Check, MapPin, Search } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, Card, CardContent, Skeleton, Input } from "@/components/ui";
import { api, type Course, type Tee, type CourseDetail } from "@/lib/api";
import { getTeeColor } from "@/lib/utils";

type Step = "course" | "tee" | "confirm";

// Helper to categorize tees as primary vs alternate
function categorizeTees(tees: Tee[]): { primary: Tee[]; alternate: Tee[] } {
  const alternate: Tee[] = [];
  const primary: Tee[] = [];

  for (const tee of tees) {
    const name = tee.name.toLowerCase();
    // Alternate tees: combo tees (contain "/"), family tees, or flag variants
    if (
      name.includes("/") ||
      name.includes("family") ||
      name.includes("combo") ||
      name.includes("(gold)") ||
      name.includes("(white)") ||
      name.includes("left #")
    ) {
      alternate.push(tee);
    } else {
      primary.push(tee);
    }
  }

  // Sort primary by yardage descending (longest first)
  primary.sort((a, b) => (b.totalYardage || 0) - (a.totalYardage || 0));
  alternate.sort((a, b) => (b.totalYardage || 0) - (a.totalYardage || 0));

  return { primary, alternate };
}

export default function NewRoundPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [step, setStep] = useState<Step>("course");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [selectedTee, setSelectedTee] = useState<Tee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAlternateTees, setShowAlternateTees] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Filter courses by search query
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const query = searchQuery.toLowerCase();
    return courses.filter(
      (course) =>
        course.name.toLowerCase().includes(query) ||
        course.city?.toLowerCase().includes(query) ||
        course.state?.toLowerCase().includes(query)
    );
  }, [courses, searchQuery]);

  // Categorize tees into primary and alternate
  const { primary: primaryTees, alternate: alternateTees } = useMemo(() => {
    if (!selectedCourse?.tees) return { primary: [], alternate: [] };
    return categorizeTees(selectedCourse.tees);
  }, [selectedCourse?.tees]);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getCourses(token);
        setCourses(data);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourses();
  }, [getToken]);

  const handleSelectCourse = async (course: Course) => {
    try {
      const token = await getToken();
      if (!token) return;
      const detail = await api.getCourse(token, course.id);
      setSelectedCourse(detail);
      setStep("tee");
    } catch (error) {
      console.error("Failed to fetch course details:", error);
    }
  };

  const handleSelectTee = (tee: Tee) => {
    setSelectedTee(tee);
    setStep("confirm");
  };

  const handleCreateRound = async () => {
    if (!selectedCourse || !selectedTee) return;

    setIsCreating(true);
    try {
      const token = await getToken();
      if (!token) return;

      const round = await api.createRound(token, {
        courseId: selectedCourse.id,
        teeId: selectedTee.id,
        date: selectedDate,
      });

      router.push(`/rounds/${round.id}`);
    } catch (error) {
      console.error("Failed to create round:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <Header
        title={
          step === "course"
            ? "Select Course"
            : step === "tee"
            ? "Select Tees"
            : "Confirm Round"
        }
        showBack
      />

      <div className="p-lg">
        {/* Step: Select Course */}
        {step === "course" && (
          <div className="space-y-md">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </>
            ) : filteredCourses.length > 0 ? (
              filteredCourses.map((course, index) => (
                <button
                  key={course.id}
                  onClick={() => handleSelectCourse(course)}
                  className="w-full text-left"
                >
                  <Card
                    className="relative overflow-hidden rounded-xl animate-fade-in-up group"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Hero Image Background */}
                    <div className="absolute inset-0">
                      {course.heroImageUrl ? (
                        <img
                          src={course.heroImageUrl}
                          alt={course.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
                      )}
                      {/* Glass overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
                    </div>

                    {/* Content */}
                    <CardContent className="relative z-10 p-lg py-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-xs flex-1 min-w-0">
                          <p className="text-body font-semibold text-white truncate drop-shadow-md">
                            {course.name}
                          </p>
                          {(course.city || course.state) && (
                            <div className="flex items-center gap-xs text-caption text-white/80">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="drop-shadow-sm">
                                {[course.city, course.state]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-white/70 flex-shrink-0 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))
            ) : searchQuery ? (
              <Card>
                <CardContent className="p-xl text-center">
                  <p className="text-muted">No courses found</p>
                  <p className="text-caption text-subtle mt-xs">
                    Try a different search term
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-xl text-center">
                  <p className="text-muted">No courses yet</p>
                  <p className="text-caption text-subtle mt-xs">
                    Add a course first
                  </p>
                  <Button
                    className="mt-lg"
                    onClick={() => router.push("/courses/add")}
                  >
                    Add Course
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step: Select Tee */}
        {step === "tee" && selectedCourse && (
          <div className="space-y-md">
            <Card className="mb-lg">
              <CardContent className="p-lg">
                <p className="text-caption text-muted">Course</p>
                <p className="text-body font-medium">{selectedCourse.name}</p>
              </CardContent>
            </Card>

            {/* Primary Tees */}
            {primaryTees.map((tee) => (
              <button
                key={tee.id}
                onClick={() => handleSelectTee(tee)}
                className="w-full text-left"
              >
                <Card className="card-hover">
                  <CardContent className="p-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-md">
                        <div
                          className="w-6 h-6 rounded-full border-2 border-border"
                          style={{ backgroundColor: getTeeColor(tee.name, tee.color) }}
                        />
                        <div>
                          <p className="text-body font-medium">{tee.name}</p>
                          <div className="flex items-center gap-md text-caption text-muted">
                            {tee.totalYardage && (
                              <span>{tee.totalYardage.toLocaleString()} yds</span>
                            )}
                            {tee.slopeRating && (
                              <span>Slope: {tee.slopeRating}</span>
                            )}
                            {tee.courseRating && (
                              <span>Rating: {tee.courseRating}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted" />
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}

            {/* Alternate Tees (Expandable) */}
            {alternateTees.length > 0 && (
              <div className="mt-lg">
                <button
                  onClick={() => setShowAlternateTees(!showAlternateTees)}
                  className="w-full flex items-center justify-between py-3 px-1 text-muted hover:text-foreground transition-colors"
                >
                  <span className="text-caption font-medium uppercase tracking-wide">
                    {showAlternateTees ? "Hide" : "Show"} {alternateTees.length} more tee{alternateTees.length > 1 ? "s" : ""}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAlternateTees ? "rotate-180" : ""}`}
                  />
                </button>

                {showAlternateTees && (
                  <div className="space-y-md mt-md">
                    {alternateTees.map((tee) => (
                      <button
                        key={tee.id}
                        onClick={() => handleSelectTee(tee)}
                        className="w-full text-left"
                      >
                        <Card className="card-hover border-dashed">
                          <CardContent className="p-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-md">
                                <div
                                  className="w-6 h-6 rounded-full border-2 border-border"
                                  style={{ backgroundColor: getTeeColor(tee.name, tee.color) }}
                                />
                                <div>
                                  <p className="text-body font-medium">{tee.name}</p>
                                  <div className="flex items-center gap-md text-caption text-muted">
                                    {tee.totalYardage && (
                                      <span>{tee.totalYardage.toLocaleString()} yds</span>
                                    )}
                                    {tee.slopeRating && (
                                      <span>Slope: {tee.slopeRating}</span>
                                    )}
                                    {tee.courseRating && (
                                      <span>Rating: {tee.courseRating}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted" />
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && selectedCourse && selectedTee && (
          <div className="space-y-lg">
            <Card>
              <CardContent className="p-lg space-y-lg">
                <div>
                  <p className="text-caption text-muted">Course</p>
                  <p className="text-body font-medium">{selectedCourse.name}</p>
                </div>
                <div>
                  <p className="text-caption text-muted">Tees</p>
                  <div className="flex items-center gap-sm">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getTeeColor(selectedTee.name, selectedTee.color) }}
                    />
                    <p className="text-body font-medium">{selectedTee.name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-caption text-muted">Date</p>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full h-14"
              size="lg"
              onClick={handleCreateRound}
              isLoading={isCreating}
            >
              <Check className="h-5 w-5 mr-2" />
              Create Round
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
