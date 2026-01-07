"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, MapPin, ChevronRight, Check, Home, Navigation } from "lucide-react";
import { Card, CardContent, Skeleton, EmptyState, FAB } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { CourseMapIllustration } from "@/components/illustrations";
import { api, type Course } from "@/lib/api";

// Haversine formula to calculate distance between two coordinates in miles
function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface CourseWithDistance extends Course {
  distance?: number;
}

export default function CoursesPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const selectMode = searchParams.get("select"); // "round" when selecting for new round
  const [courses, setCourses] = useState<Course[]>([]);
  const [homeCourseIds, setHomeCourseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  // Get user's location
  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.log("Location access denied or unavailable:", error.message);
        // Don't show error - just fall back to alphabetical sorting
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const token = await getToken();
        if (!token) return;

        // Fetch courses and home courses in parallel
        const [coursesData, homeCoursesData] = await Promise.all([
          api.getCourses(token),
          api.getHomeCourses(token),
        ]);

        setCourses(coursesData);
        setHomeCourseIds(new Set(homeCoursesData.map(c => c.id)));
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourses();
  }, [getToken]);

  // Calculate distances and sort courses
  const { sortedCourses, nearestDistance } = useMemo(() => {
    let filtered: CourseWithDistance[] = courses;

    if (searchQuery) {
      filtered = courses.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.state?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Calculate distances if we have user location
    if (userLocation) {
      filtered = filtered.map((course) => {
        if (course.latitude && course.longitude) {
          return {
            ...course,
            distance: calculateDistanceMiles(
              userLocation.latitude,
              userLocation.longitude,
              course.latitude,
              course.longitude
            ),
          };
        }
        return course;
      });
    }

    // Sort: home courses first, then by distance (if available), then alphabetically
    const sorted = filtered.sort((a, b) => {
      const aIsHome = homeCourseIds.has(a.id);
      const bIsHome = homeCourseIds.has(b.id);
      if (aIsHome && !bIsHome) return -1;
      if (!aIsHome && bIsHome) return 1;

      // If both have distances, sort by distance
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      // Courses with distance come before those without
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;

      return a.name.localeCompare(b.name);
    });

    // Find nearest distance (excluding home courses for the "no nearby" check)
    const nearestNonHome = sorted.find(
      (c) => c.distance !== undefined && !homeCourseIds.has(c.id)
    );
    const nearest = sorted.find((c) => c.distance !== undefined);

    return {
      sortedCourses: sorted,
      nearestDistance: nearest?.distance ?? nearestNonHome?.distance,
    };
  }, [courses, homeCourseIds, searchQuery, userLocation]);

  // Check if we should show the "no nearby courses" banner
  const showNearbyBanner = userLocation && nearestDistance !== undefined && nearestDistance > 50;

  // Determine link destination based on mode
  const getCourseHref = (courseId: string) => {
    if (selectMode === "round") {
      return `/rounds/new?courseId=${courseId}`;
    }
    return `/courses/${courseId}`;
  };

  return (
    <div className="pb-24">
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
            className="w-full h-12 pl-12 pr-md rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
          />
        </div>

        {/* No nearby courses banner */}
        {showNearbyBanner && !searchQuery && (
          <Link href="/courses/add">
            <Card className="glass-card border-amber-500/30 bg-amber-500/10 animate-fade-in-up">
              <CardContent className="p-md">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Navigation className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">No courses nearby</p>
                    <p className="text-sm text-muted">Add your local course to get started</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-amber-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Courses List */}
        {isLoading ? (
          <div className="space-y-md">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : sortedCourses.length > 0 ? (
          <div className="space-y-md">
            {sortedCourses.map((course, _index) => (
              <Link key={course.id} href={getCourseHref(course.id)}>
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
                          {homeCourseIds.has(course.id) && (
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                              <Home className="h-3 w-3 text-white" />
                            </div>
                          )}
                          <p className="text-body font-semibold text-white truncate drop-shadow-md">
                            {course.name}
                          </p>
                          {course.isVerified && (
                            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-md text-caption text-white/80">
                          {(course.city || course.state) && (
                            <div className="flex items-center gap-xs">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="drop-shadow-sm">
                                {[course.city, course.state]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                          {course.distance !== undefined && (
                            <span className="text-white/60">
                              {course.distance < 1
                                ? "< 1 mi"
                                : `${Math.round(course.distance)} mi`}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-white/70 flex-shrink-0 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : searchQuery ? (
          <EmptyState
            illustration={<CourseMapIllustration className="w-full h-full opacity-60" />}
            title="No courses found"
            description="Try a different search or add a new course"
          />
        ) : (
          <EmptyState
            illustration={<CourseMapIllustration className="w-full h-full" />}
            title="No courses yet"
            description="Add your first course to get started"
            action={{
              label: "Add Course",
              href: "/courses/add",
              icon: <Plus className="h-4 w-4 mr-2" />,
            }}
          />
        )}
      </div>

      <FAB href="/courses/add" label="Add a new course" show={!selectMode} />
    </div>
  );
}
