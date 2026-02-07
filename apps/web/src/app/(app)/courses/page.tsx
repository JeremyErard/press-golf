"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, MapPin, ChevronRight, Check, Home, Star, Navigation } from "lucide-react";
import { Card, CardContent, Skeleton, EmptyState, FAB } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { TabHelpSheet } from "@/components/onboarding/tab-help-sheet";
import { HelpButton } from "@/components/onboarding/help-button";
import { CourseMapIllustration } from "@/components/illustrations";
import { api, type Course, type CourseWithMeta, type DiscoverCoursesResponse } from "@/lib/api";
import { formatCourseName } from "@/lib/utils";

interface UserLocation {
  latitude: number;
  longitude: number;
}

export default function CoursesPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const selectMode = searchParams.get("select"); // "round" when selecting for new round
  const [showHelp, setShowHelp] = useState(false);

  const [discoverData, setDiscoverData] = useState<DiscoverCoursesResponse | null>(null);
  const [searchResults, setSearchResults] = useState<(Course & { roundCount?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<"loading" | "granted" | "denied" | "unavailable">("loading");

  // Get user's location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("granted");
      },
      (error) => {
        console.log("Location access denied or unavailable:", error.message);
        setLocationStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Fetch discover data when location is available
  const fetchDiscoverData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const data = await api.discoverCourses(
        token,
        userLocation?.latitude,
        userLocation?.longitude
      );
      setDiscoverData(data);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, userLocation]);

  useEffect(() => {
    // Fetch as soon as we have auth, don't wait for location
    fetchDiscoverData();
  }, [fetchDiscoverData]);

  // Build a map of course IDs to round counts from discover data for enrichment
  const courseRoundCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (discoverData) {
      [...(discoverData.homeCourses || []), ...(discoverData.nearby || []), ...(discoverData.featured || [])].forEach(c => {
        if (c.roundCount !== undefined) {
          counts.set(c.id, c.roundCount);
        }
      });
    }
    return counts;
  }, [discoverData]);

  // Search courses
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = await getToken();
      if (!token) return;

      const results = await api.getCourses(token);
      const filtered = results.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.city?.toLowerCase().includes(query.toLowerCase()) ||
          c.state?.toLowerCase().includes(query.toLowerCase())
      );
      // Enrich search results with round counts from discover data if available
      const enriched = filtered.map(c => ({
        ...c,
        roundCount: courseRoundCounts.get(c.id),
      }));
      setSearchResults(enriched);
    } catch (error) {
      console.error("Failed to search courses:", error);
    } finally {
      setIsSearching(false);
    }
  }, [getToken, courseRoundCounts]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Determine link destination based on mode
  const getCourseHref = (courseId: string) => {
    if (selectMode === "round") {
      return `/rounds/new?courseId=${courseId}`;
    }
    return `/courses/${courseId}`;
  };

  // Course card component
  const CourseCard = ({ course, index, isHome = false }: { course: CourseWithMeta | Course; index: number; isHome?: boolean }) => (
    <Link href={getCourseHref(course.id)}>
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
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>

        {/* Content */}
        <CardContent className="relative z-10 p-lg py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-xs flex-1 min-w-0">
              <div className="flex items-center gap-sm">
                {isHome && (
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                    <Home className="h-3 w-3 text-white" />
                  </div>
                )}
                <p className="text-body font-semibold text-white truncate drop-shadow-md">
                  {formatCourseName(course.name)}
                </p>
                {course.isVerified && (
                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-brand flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-md text-caption text-white/80">
                {(course.city || course.state || course.country) && (
                  <div className="flex items-center gap-xs">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="drop-shadow-sm">
                      {[course.city, course.state, course.country && course.country !== 'USA' ? course.country : null].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
                {"distance" in course && course.distance !== undefined && (
                  <span className="text-white/60">
                    {course.distance < 1 ? "< 1 mi" : `${Math.round(course.distance)} mi`}
                  </span>
                )}
                {"roundCount" in course && course.roundCount !== undefined && course.roundCount > 0 && (
                  <span className="text-white/60">
                    {course.roundCount} {course.roundCount === 1 ? "round" : "rounds"}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/70 flex-shrink-0 transition-transform group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  // Section header component
  const SectionHeader = ({ icon: Icon, title }: { icon: typeof Home; title: string }) => (
    <div className="flex items-center gap-sm mb-md">
      <Icon className="h-4 w-4 text-muted" />
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">{title}</h2>
    </div>
  );

  const isSearchMode = searchQuery.length > 0;
  const homeCourseIds = new Set(discoverData?.homeCourses.map(c => c.id) || []);

  return (
    <div className="pb-24">
      <Header
        title={selectMode === "round" ? "Select Course" : "Courses"}
        showBack={selectMode === "round"}
        rightAction={<HelpButton onClick={() => setShowHelp(true)} />}
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

        {isLoading ? (
          <div className="space-y-md">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : isSearchMode ? (
          // Search Results
          isSearching ? (
            <div className="space-y-md">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-md">
              {searchResults.map((course, index) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  index={index}
                  isHome={homeCourseIds.has(course.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              illustration={<CourseMapIllustration className="w-full h-full opacity-60" />}
              title="No courses found"
              description="Try a different search or add a new course"
            />
          )
        ) : (
          // Discover View
          <div className="space-y-xl">
            {/* Home Courses */}
            {discoverData?.homeCourses && discoverData.homeCourses.length > 0 && (
              <div>
                <SectionHeader icon={Home} title="Your Home Courses" />
                <div className="space-y-md">
                  {discoverData.homeCourses.map((course, index) => (
                    <CourseCard key={course.id} course={course} index={index} isHome />
                  ))}
                </div>
              </div>
            )}

            {/* Nearby Courses */}
            {discoverData?.nearby && discoverData.nearby.length > 0 ? (
              <div>
                <SectionHeader icon={Navigation} title="Nearby" />
                <div className="space-y-md">
                  {discoverData.nearby.map((course, index) => (
                    <CourseCard key={course.id} course={course} index={index} />
                  ))}
                </div>
              </div>
            ) : (locationStatus === "denied" || locationStatus === "unavailable") && (
              <button
                onClick={() => {
                  if (!navigator.geolocation) return;
                  setLocationStatus("loading");
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                      });
                      setLocationStatus("granted");
                    },
                    () => {
                      setLocationStatus("denied");
                      // On iOS/Android, if permanently denied, we can't do much
                      // Show an alert with instructions
                      alert("Location access is blocked. Please enable location for this site in your browser or device settings, then refresh the page.");
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
                  );
                }}
                className="w-full p-4 rounded-xl bg-card border border-border hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <Navigation className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Enable location for nearby courses</p>
                    <p className="text-xs text-muted mt-1">
                      {locationStatus === "denied"
                        ? "Tap to enable location access and see courses near you."
                        : "Location services are not available on this device."}
                    </p>
                  </div>
                </div>
              </button>
            )}

            {/* Featured Courses */}
            {discoverData?.featured && discoverData.featured.length > 0 && (
              <div>
                <SectionHeader icon={Star} title="Featured Courses" />
                <div className="space-y-md">
                  {discoverData.featured.map((course, index) => (
                    <CourseCard key={course.id} course={course} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state if nothing to show */}
            {(!discoverData?.homeCourses?.length &&
              !discoverData?.nearby?.length &&
              !discoverData?.featured?.length) && (
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
        )}
      </div>

      <FAB href="/courses/add" label="Add a new course" show={!selectMode} />

      <TabHelpSheet
        tabKey="courses"
        open={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}
