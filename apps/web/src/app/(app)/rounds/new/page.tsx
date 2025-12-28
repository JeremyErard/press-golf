"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ChevronRight, Check, MapPin } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, Card, CardContent, Skeleton } from "@/components/ui";
import { api, type Course, type Tee, type CourseDetail } from "@/lib/api";

type Step = "course" | "tee" | "confirm";

export default function NewRoundPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [step, setStep] = useState<Step>("course");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null);
  const [selectedTee, setSelectedTee] = useState<Tee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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
            {isLoading ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </>
            ) : courses.length > 0 ? (
              courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleSelectCourse(course)}
                  className="w-full text-left"
                >
                  <Card className="card-hover">
                    <CardContent className="p-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-body font-medium">{course.name}</p>
                          {(course.city || course.state) && (
                            <div className="flex items-center gap-xs text-caption text-muted mt-xs">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>
                                {[course.city, course.state]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted" />
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))
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

            {selectedCourse.tees.map((tee) => (
              <button
                key={tee.id}
                onClick={() => handleSelectTee(tee)}
                className="w-full text-left"
              >
                <Card className="card-hover">
                  <CardContent className="p-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-md">
                        {tee.color && (
                          <div
                            className="w-6 h-6 rounded-full border-2 border-border"
                            style={{ backgroundColor: tee.color }}
                          />
                        )}
                        <div>
                          <p className="text-body font-medium">{tee.name}</p>
                          <div className="flex items-center gap-md text-caption text-muted">
                            {tee.totalYardage && (
                              <span>{tee.totalYardage} yds</span>
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
                    {selectedTee.color && (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: selectedTee.color }}
                      />
                    )}
                    <p className="text-body font-medium">{selectedTee.name}</p>
                  </div>
                </div>
                <div>
                  <p className="text-caption text-muted">Date</p>
                  <p className="text-body font-medium">Today</p>
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
