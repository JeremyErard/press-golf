"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, MapPin, ChevronRight, Check } from "lucide-react";
import { Button, Card, CardContent, Skeleton } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { CourseMapIllustration } from "@/components/illustrations";
import { api, type Course } from "@/lib/api";

export default function CoursesPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const selectMode = searchParams.get("select"); // "round" when selecting for new round
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredCourses = searchQuery
    ? courses.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.state?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : courses;

  // Determine link destination based on mode
  const getCourseHref = (courseId: string) => {
    if (selectMode === "round") {
      return `/rounds/new?courseId=${courseId}`;
    }
    return `/courses/${courseId}`;
  };

  return (
    <div>
      <Header
        title={selectMode === "round" ? "Select Course" : "Courses"}
        showBack={selectMode === "round"}
      />

      <div className="p-lg space-y-lg">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-md top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-md rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
          />
        </div>

        {/* Courses List */}
        {isLoading ? (
          <div className="space-y-md">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredCourses.length > 0 ? (
          <div
            className="space-y-md"
            
            
          >
            {filteredCourses.map((course, _index) => (
              <div
                key={course.id}
                
                
                
              >
                <Link href={getCourseHref(course.id)}>
                  <Card
                    className="relative overflow-hidden rounded-xl animate-fade-in-up group"
                    style={{ animationDelay: `${_index * 30}ms` }}
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
                          <div className="flex items-center gap-sm">
                            <p className="text-body font-semibold text-white truncate drop-shadow-md">
                              {course.name}
                            </p>
                            {course.isVerified && (
                              <div className="flex-shrink-0 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </div>
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
                </Link>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <Card className="glass-card">
            <CardContent className="py-12 px-6 text-center">
              <div className="w-24 h-24 mx-auto mb-6 opacity-60">
                <CourseMapIllustration className="w-full h-full" />
              </div>
              <p className="text-white font-semibold text-lg">No courses found</p>
              <p className="text-gray-400 text-sm mt-2">
                Try a different search or add a new course
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardContent className="py-12 px-6 text-center">
              <div className="w-32 h-32 mx-auto mb-6 animate-float">
                <CourseMapIllustration className="w-full h-full" />
              </div>
              <p className="text-white font-semibold text-lg">No courses yet</p>
              <p className="text-gray-400 text-sm mt-2">
                Add your first course to get started
              </p>
              <Link href="/courses/add" className="inline-block mt-6">
                <Button className="btn-ripple">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Course
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* FAB - hide in select mode */}
      {!selectMode && (
        <Link
          href="/courses/add"
          className="fixed bottom-24 right-lg z-40"
        >
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
      )}
    </div>
  );
}
