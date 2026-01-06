"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, Search, MapPin, ChevronRight, Check } from "lucide-react";
import { Button, Card, CardContent, Skeleton } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { CourseMapIllustration } from "@/components/illustrations";
import { CourseThumbnail } from "@/components/course-image";
import { api, type Course } from "@/lib/api";

export default function CoursesPage() {
  const { getToken } = useAuth();
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

  return (
    <div>
      <Header title="Courses" />

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
                <Link href={`/courses/${course.id}`}>
                  <Card className="glass-card-hover animate-fade-in-up" style={{ animationDelay: `${_index * 30}ms` }}>
                    <CardContent className="p-lg">
                      <div className="flex items-center gap-md">
                        {/* Course Thumbnail */}
                        <CourseThumbnail
                          courseName={course.name}
                          heroImageUrl={course.heroImageUrl}
                          className="w-12 h-12 flex-shrink-0"
                        />
                        <div className="space-y-xs flex-1 min-w-0">
                          <div className="flex items-center gap-sm">
                            <p className="text-body font-medium truncate">
                              {course.name}
                            </p>
                            {course.isVerified && (
                              <div className="flex-shrink-0 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </div>
                          {(course.city || course.state) && (
                            <div className="flex items-center gap-xs text-caption text-muted">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>
                                {[course.city, course.state]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted flex-shrink-0" />
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

      {/* FAB */}
      <Link
        href="/courses/add"
        className="fixed bottom-24 right-lg z-40"
      >
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}
