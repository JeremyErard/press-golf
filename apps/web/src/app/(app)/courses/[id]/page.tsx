"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { MapPin, Check, Flag, ChevronDown, Play } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, Skeleton, Button } from "@/components/ui";
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

  // Categorize tees into primary and alternate
  const { primary: primaryTees, alternate: alternateTees } = useMemo(() => {
    if (!course?.tees) return { primary: [], alternate: [] };
    return categorizeTees(course.tees);
  }, [course?.tees]);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getCourse(token, params.id as string);
        setCourse(data);
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

  return (
    <div>
      <Header title={course.name} showBack />

      {/* Hero Image */}
      <div className="relative h-40 -mt-px">
        <CourseImage courseName={course.name} className="absolute inset-0" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="p-lg space-y-lg -mt-8 relative z-10">
        {/* Course Info */}
        <Card className="glass-card animate-fade-in-up">
          <CardContent className="p-lg">
            <div className="flex items-start gap-md">
              <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
                <Flag className="w-6 h-6 text-brand" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-sm">
                  <h2 className="text-lg font-semibold text-foreground">
                    {course.name}
                  </h2>
                  {course.isVerified && (
                    <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                {(course.city || course.state) && (
                  <div className="flex items-center gap-xs text-sm text-muted mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {[course.city, course.state, course.country]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tees */}
        {course.tees && course.tees.length > 0 && (
          <div className="space-y-md animate-fade-in-up" style={{ animationDelay: "100ms" }}>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide px-1">
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
                      className="flex items-center justify-between p-lg"
                    >
                      <div className="flex items-center gap-md">
                        <div
                          className="w-4 h-4 rounded-full border-2"
                          style={{
                            backgroundColor: color,
                            borderColor: color === "#FFFFFF" ? "#ccc" : color,
                          }}
                        />
                        <span className="font-medium text-foreground">
                          {tee.name}
                        </span>
                      </div>
                      <div className="text-right text-sm">
                        {tee.totalYardage && (
                          <p className="text-foreground">
                            {tee.totalYardage.toLocaleString()} yds
                          </p>
                        )}
                        {tee.courseRating && tee.slopeRating && (
                          <p className="text-muted text-xs">
                            {tee.courseRating} / {tee.slopeRating}
                          </p>
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
                      className="w-full flex items-center justify-between p-lg text-muted hover:text-foreground transition-colors"
                    >
                      <span className="text-sm font-medium">
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
                          className="flex items-center justify-between p-lg bg-surface/50"
                        >
                          <div className="flex items-center gap-md">
                            <div
                              className="w-4 h-4 rounded-full border-2"
                              style={{
                                backgroundColor: color,
                                borderColor: color === "#FFFFFF" ? "#ccc" : color,
                              }}
                            />
                            <span className="font-medium text-foreground">
                              {tee.name}
                            </span>
                          </div>
                          <div className="text-right text-sm">
                            {tee.totalYardage && (
                              <p className="text-foreground">
                                {tee.totalYardage.toLocaleString()} yds
                              </p>
                            )}
                            {tee.courseRating && tee.slopeRating && (
                              <p className="text-muted text-xs">
                                {tee.courseRating} / {tee.slopeRating}
                              </p>
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

        {/* Holes */}
        {course.holes && course.holes.length > 0 && (
          <div className="space-y-md animate-fade-in-up" style={{ animationDelay: "200ms" }}>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide px-1">
              Scorecard
            </h3>
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-3 py-2 text-left text-muted font-medium">Hole</th>
                        <th className="px-3 py-2 text-center text-muted font-medium">Par</th>
                        <th className="px-3 py-2 text-center text-muted font-medium">Hdcp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.holes.map((hole, idx) => (
                        <tr
                          key={hole.id}
                          className={idx % 2 === 0 ? "bg-card" : "bg-surface"}
                        >
                          <td className="px-3 py-2 font-medium text-foreground">
                            {hole.holeNumber}
                          </td>
                          <td className="px-3 py-2 text-center text-foreground">
                            {hole.par}
                          </td>
                          <td className="px-3 py-2 text-center text-muted">
                            {hole.handicapRank}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Start Round CTA */}
        <div className="pt-4">
          <Button
            className="w-full h-14 btn-ripple shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            size="lg"
            onClick={() => router.push(`/rounds/new?courseId=${course.id}`)}
          >
            <Play className="h-5 w-5 mr-2" />
            Start a Round Here
          </Button>
        </div>
      </div>
    </div>
  );
}
