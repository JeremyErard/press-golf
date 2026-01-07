"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { MapPin, Check, Flag, ChevronDown, Play, Home } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Skeleton, Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { api, type CourseDetail, type Tee } from "@/lib/api";
import { getTeeColor } from "@/lib/utils";
import { CourseImage } from "@/components/course-image";

// Helper to categorize tees as primary vs alternate
function categorizeTees(tees: Tee[]): { primary: Tee[]; alternate: Tee[] } {
  const alternate: Tee[] = [];
  const primary: Tee[] = [];

  for (const tee of tees) {
    const name = tee.name.toLowerCase();
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

  primary.sort((a, b) => (b.totalYardage || 0) - (a.totalYardage || 0));
  alternate.sort((a, b) => (b.totalYardage || 0) - (a.totalYardage || 0));

  return { primary, alternate };
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAlternateTees, setShowAlternateTees] = useState(false);
  const [isHomeCourse, setIsHomeCourse] = useState(false);
  const [isTogglingHome, setIsTogglingHome] = useState(false);

  // Categorize tees into primary and alternate
  const { primary: primaryTees, alternate: alternateTees } = useMemo(() => {
    if (!course?.tees) return { primary: [], alternate: [] };
    return categorizeTees(course.tees);
  }, [course?.tees]);

  // Split holes into front 9 and back 9
  const frontNine = useMemo(() => {
    if (!course?.holes) return [];
    return course.holes.filter(h => h.holeNumber <= 9).sort((a, b) => a.holeNumber - b.holeNumber);
  }, [course?.holes]);

  const backNine = useMemo(() => {
    if (!course?.holes) return [];
    return course.holes.filter(h => h.holeNumber > 9).sort((a, b) => a.holeNumber - b.holeNumber);
  }, [course?.holes]);

  // Calculate total par for front/back
  const frontPar = useMemo(() => frontNine.reduce((sum, h) => sum + h.par, 0), [frontNine]);
  const backPar = useMemo(() => backNine.reduce((sum, h) => sum + h.par, 0), [backNine]);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const token = await getToken();
        if (!token) return;

        // Fetch course details and home courses in parallel
        const [courseData, homeCourses] = await Promise.all([
          api.getCourse(token, params.id as string),
          api.getHomeCourses(token),
        ]);

        setCourse(courseData);
        setIsHomeCourse(homeCourses.some(c => c.id === params.id));
      } catch (err) {
        console.error("Failed to fetch course:", err);
        setError("Failed to load course");
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) {
      fetchCourse();
    }
  }, [getToken, params.id]);

  const toggleHomeCourse = useCallback(async () => {
    if (!course) return;

    setIsTogglingHome(true);
    try {
      const token = await getToken();
      if (!token) return;

      if (isHomeCourse) {
        await api.removeHomeCourse(token, course.id);
        setIsHomeCourse(false);
      } else {
        await api.addHomeCourse(token, course.id);
        setIsHomeCourse(true);
      }
    } catch (err) {
      console.error("Failed to toggle home course:", err);
    } finally {
      setIsTogglingHome(false);
    }
  }, [course, getToken, isHomeCourse]);

  if (isLoading) {
    return (
      <div>
        <Header title="Course" showBack />
        <div className="p-lg space-y-lg">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div>
        <Header title="Course" showBack />
        <div className="p-lg">
          <Card>
            <CardContent className="p-xl text-center">
              <p className="text-red-400">{error || "Course not found"}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render scorecard grid for a nine
  const renderScorecardGrid = (holes: typeof frontNine, isFront: boolean) => {
    const parTotal = isFront ? frontPar : backPar;

    return (
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[360px] border-collapse text-sm">
          <thead>
            {/* Hole numbers */}
            <tr className="border-b border-border/50">
              <th className="sticky left-0 z-10 bg-card w-12 text-left py-2 px-2">
                <span className="text-xs text-muted font-medium">HOLE</span>
              </th>
              {holes.map((hole) => (
                <th key={hole.holeNumber} className="text-center py-2 px-1 min-w-[32px]">
                  <span className="text-xs text-muted font-medium">{hole.holeNumber}</span>
                </th>
              ))}
              <th className="text-center py-2 px-2 min-w-[40px] border-l border-border/50">
                <span className="text-xs text-muted font-medium">{isFront ? "OUT" : "IN"}</span>
              </th>
            </tr>

            {/* Par row */}
            <tr className="border-b border-border/50 bg-surface/50">
              <td className="sticky left-0 z-10 bg-surface/50 py-1.5 px-2">
                <span className="text-xs text-muted">PAR</span>
              </td>
              {holes.map((hole) => (
                <td key={hole.holeNumber} className="text-center py-1.5 px-1">
                  <span className="text-xs font-medium">{hole.par}</span>
                </td>
              ))}
              <td className="text-center py-1.5 px-2 border-l border-border/50">
                <span className="text-xs font-semibold">{parTotal}</span>
              </td>
            </tr>

            {/* Handicap rank row */}
            <tr className="border-b border-border/30">
              <td className="sticky left-0 z-10 bg-card py-1.5 px-2">
                <span className="text-xs text-muted">HCP</span>
              </td>
              {holes.map((hole) => (
                <td key={hole.holeNumber} className="text-center py-1.5 px-1">
                  <span className="text-xs text-muted">{hole.handicapRank}</span>
                </td>
              ))}
              <td className="text-center py-1.5 px-2 border-l border-border/50"></td>
            </tr>
          </thead>
        </table>
      </div>
    );
  };

  return (
    <div>
      <Header title={course.name} showBack />

      {/* Compact Hero Image */}
      <div className="relative h-28 -mt-px">
        <CourseImage courseName={course.name} className="absolute inset-0" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="p-lg space-y-md -mt-6 relative z-10">
        {/* Course Info Card */}
        <Card className="glass-card animate-fade-in-up">
          <CardContent className="p-md">
            <div className="flex items-start gap-md">
              <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center flex-shrink-0">
                <Flag className="w-5 h-5 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-sm">
                  <h2 className="text-base font-semibold text-foreground truncate">
                    {course.name}
                  </h2>
                  {course.isVerified && (
                    <div className="w-4 h-4 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                {(course.city || course.state) && (
                  <div className="flex items-center gap-xs text-xs text-muted mt-0.5">
                    <MapPin className="h-3 w-3" />
                    <span>
                      {[course.city, course.state, course.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>
              {/* Home Course Toggle */}
              <button
                onClick={toggleHomeCourse}
                disabled={isTogglingHome}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
                  isHomeCourse
                    ? "bg-amber-500 text-white"
                    : "bg-white/10 text-muted hover:bg-white/20"
                } ${isTogglingHome ? "opacity-50" : ""}`}
              >
                <Home className="h-3.5 w-3.5" />
                <span>{isHomeCourse ? "Home" : "Set Home"}</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Start Round CTA - Primary Action */}
        <Button
          className="w-full h-12 btn-ripple shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          size="lg"
          onClick={() => router.push(`/rounds/new?courseId=${course.id}`)}
        >
          <Play className="h-5 w-5 mr-2" />
          Start a Round Here
        </Button>

        {/* Tees - Compact */}
        {course.tees && course.tees.length > 0 && (
          <div className="space-y-sm animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide px-1">
              Tees
            </h3>
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0 divide-y divide-white/5">
                {/* Primary Tees */}
                {primaryTees.map((tee) => {
                  const color = getTeeColor(tee.name, tee.color);
                  return (
                    <div
                      key={tee.id}
                      className="flex items-center justify-between py-2.5 px-md"
                    >
                      <div className="flex items-center gap-sm">
                        <div
                          className="w-3.5 h-3.5 rounded-full border-2"
                          style={{
                            backgroundColor: color,
                            borderColor: color === "#FFFFFF" ? "#ccc" : color,
                          }}
                        />
                        <span className="text-sm font-medium text-foreground">
                          {tee.name}
                        </span>
                      </div>
                      <div className="text-right text-xs">
                        {tee.totalYardage && (
                          <span className="text-foreground font-medium">
                            {tee.totalYardage.toLocaleString()} yds
                          </span>
                        )}
                        {tee.courseRating && tee.slopeRating && (
                          <span className="text-muted ml-2">
                            {tee.courseRating}/{tee.slopeRating}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Alternate Tees (Expandable) */}
                {alternateTees.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowAlternateTees(!showAlternateTees)}
                      className="w-full flex items-center justify-between py-2 px-md text-muted hover:text-foreground transition-colors"
                    >
                      <span className="text-xs font-medium">
                        {showAlternateTees ? "Hide" : "Show"} {alternateTees.length} alternate tee{alternateTees.length > 1 ? "s" : ""}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAlternateTees ? "rotate-180" : ""}`}
                      />
                    </button>

                    {showAlternateTees && alternateTees.map((tee) => {
                      const color = getTeeColor(tee.name, tee.color);
                      return (
                        <div
                          key={tee.id}
                          className="flex items-center justify-between py-2.5 px-md bg-surface/50"
                        >
                          <div className="flex items-center gap-sm">
                            <div
                              className="w-3.5 h-3.5 rounded-full border-2"
                              style={{
                                backgroundColor: color,
                                borderColor: color === "#FFFFFF" ? "#ccc" : color,
                              }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {tee.name}
                            </span>
                          </div>
                          <div className="text-right text-xs">
                            {tee.totalYardage && (
                              <span className="text-foreground font-medium">
                                {tee.totalYardage.toLocaleString()} yds
                              </span>
                            )}
                            {tee.courseRating && tee.slopeRating && (
                              <span className="text-muted ml-2">
                                {tee.courseRating}/{tee.slopeRating}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scorecard - Grid Style with Tabs */}
        {course.holes && course.holes.length > 0 && (
          <div className="space-y-sm animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
                Scorecard
              </h3>
              <span className="text-xs text-muted">Par {frontPar + backPar}</span>
            </div>
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-md">
                <Tabs defaultValue="front" className="w-full">
                  <TabsList className="w-full mb-3">
                    <TabsTrigger
                      value="front"
                      className="flex-1 text-xs data-[state=active]:bg-brand data-[state=active]:text-white"
                    >
                      Front 9
                    </TabsTrigger>
                    <TabsTrigger
                      value="back"
                      className="flex-1 text-xs data-[state=active]:bg-brand data-[state=active]:text-white"
                    >
                      Back 9
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="front" className="mt-0">
                    {renderScorecardGrid(frontNine, true)}
                  </TabsContent>

                  <TabsContent value="back" className="mt-0">
                    {renderScorecardGrid(backNine, false)}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
