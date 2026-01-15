"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { ChevronRight, ChevronDown, Check, Crown, Users, Swords } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button, Card, CardContent, Skeleton, Input } from "@/components/ui";
import { api, type Tee, type CourseDetail, type BillingStatus, type GroupDetail, type ChallengeDetail } from "@/lib/api";
import { getTeeColor, formatCourseName } from "@/lib/utils";

type Step = "tee" | "confirm";

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
  const searchParams = useSearchParams();
  const { getToken } = useAuth();

  const courseId = searchParams.get("courseId");
  const groupId = searchParams.get("groupId");
  const challengeId = searchParams.get("challengeId");

  const [step, setStep] = useState<Step>("tee");
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [selectedTee, setSelectedTee] = useState<Tee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAlternateTees, setShowAlternateTees] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);

  // Check subscription status
  useEffect(() => {
    async function checkSubscription() {
      try {
        const token = await getToken();
        if (!token) return;
        const status = await api.getBillingStatus(token);
        setBillingStatus(status);
      } catch (error) {
        console.error("Failed to check subscription:", error);
      } finally {
        setCheckingSubscription(false);
      }
    }
    checkSubscription();
  }, [getToken]);

  const isSubscribed = billingStatus?.status === "ACTIVE" || billingStatus?.isFoundingMember;

  // Redirect to course selection if no courseId
  useEffect(() => {
    if (!courseId) {
      router.replace("/courses?select=round");
    }
  }, [courseId, router]);

  // Fetch course details
  useEffect(() => {
    async function fetchCourse() {
      if (!courseId) return;

      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getCourse(token, courseId);
        setCourse(data);
      } catch (error) {
        console.error("Failed to fetch course:", error);
        // If course not found, redirect back to selection
        router.replace("/courses?select=round");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourse();
  }, [courseId, getToken, router]);

  // Fetch group details if provided
  useEffect(() => {
    async function fetchGroup() {
      if (!groupId) return;

      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getGroup(token, groupId);
        setGroup(data);
      } catch (error) {
        console.error("Failed to fetch group:", error);
      }
    }

    fetchGroup();
  }, [groupId, getToken]);

  // Fetch challenge details if provided
  useEffect(() => {
    async function fetchChallenge() {
      if (!challengeId) return;

      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getChallenge(token, challengeId);
        setChallenge(data);
        // Set the proposed date from challenge if available
        if (data.proposedDate) {
          setSelectedDate(data.proposedDate.split("T")[0]);
        }
      } catch (error) {
        console.error("Failed to fetch challenge:", error);
      }
    }

    fetchChallenge();
  }, [challengeId, getToken]);

  // Categorize tees into primary and alternate
  const { primary: primaryTees, alternate: alternateTees } = useMemo(() => {
    if (!course?.tees) return { primary: [], alternate: [] };
    return categorizeTees(course.tees);
  }, [course?.tees]);

  const handleSelectTee = (tee: Tee) => {
    setSelectedTee(tee);
    setStep("confirm");
  };

  const handleCreateRound = async () => {
    if (!course || !selectedTee) return;

    setIsCreating(true);
    try {
      const token = await getToken();
      if (!token) return;

      const round = await api.createRound(token, {
        courseId: course.id,
        teeId: selectedTee.id,
        date: selectedDate,
        groupId: groupId || undefined,
        challengeId: challengeId || undefined,
      });

      router.push(`/rounds/${round.id}`);
    } catch (error) {
      console.error("Failed to create round:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Don't render until we have courseId (will redirect)
  if (!courseId) {
    return null;
  }

  // Show loading while checking subscription
  if (checkingSubscription) {
    return (
      <div>
        <Header title="Start Round" showBack />
        <div className="p-lg">
          <div className="space-y-md">
            <Skeleton className="h-20 w-full" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Subscription gate
  if (!isSubscribed) {
    return (
      <div>
        <Header title="Start Round" showBack />
        <div className="p-lg">
          <Card className="relative overflow-hidden rounded-xl">
            <div className="absolute inset-0">
              <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/20" />
            </div>
            <CardContent className="relative z-10 p-xl text-center">
              <div className="w-16 h-16 mx-auto mb-lg rounded-full bg-amber-500/20 flex items-center justify-center">
                <Crown className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-sm">Subscribe to Start Rounds</h2>
              <p className="text-white/70 mb-lg">
                Get unlimited rounds, score tracking, and betting games for just $2.49/month or $19.99/year. Cancel anytime.
              </p>
              <Button
                className="w-full h-12"
                size="lg"
                onClick={() => router.push("/profile/subscription")}
              >
                <Crown className="h-5 w-5 mr-2" />
                Subscribe Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={step === "tee" ? "Select Tees" : "Confirm Round"}
        showBack
      />

      <div className="p-lg">
        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-md">
            <Skeleton className="h-20 w-full" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : course ? (
          <>
            {/* Step: Select Tee */}
            {step === "tee" && (
              <div className="space-y-md">
                {/* Course Card with Hero Backdrop */}
                <Card className="relative overflow-hidden rounded-xl mb-lg">
                  <div className="absolute inset-0">
                    {course.heroImageUrl ? (
                      <Image
                        src={course.heroImageUrl}
                        alt={course.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
                  </div>
                  <CardContent className="relative z-10 p-lg">
                    <p className="text-caption text-white/70">Course</p>
                    <p className="text-body font-semibold text-white drop-shadow-md">{formatCourseName(course.name)}</p>
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
            {step === "confirm" && selectedTee && (
              <div className="space-y-lg">
                {/* Group/Challenge Info Banners */}
                {group && (
                  <Card className="bg-brand/10 border-brand/30">
                    <CardContent className="p-md flex items-center gap-md">
                      <div className="h-10 w-10 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-brand" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted">Playing with group</p>
                        <p className="font-semibold text-foreground truncate">{group.name}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {challenge && (
                  <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="p-md flex items-center gap-md">
                      <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Swords className="h-5 w-5 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted">Challenge vs</p>
                        <p className="font-semibold text-foreground truncate">
                          {challenge.opponent.displayName || challenge.opponent.firstName || "Opponent"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Course Card with Hero Backdrop */}
                <Card className="relative overflow-hidden rounded-xl">
                  <div className="absolute inset-0">
                    {course.heroImageUrl ? (
                      <Image
                        src={course.heroImageUrl}
                        alt={course.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
                  </div>
                  <CardContent className="relative z-10 p-lg space-y-md">
                    <div>
                      <p className="text-caption text-white/70">Course</p>
                      <p className="text-body font-semibold text-white drop-shadow-md">{formatCourseName(course.name)}</p>
                    </div>
                    <div>
                      <p className="text-caption text-white/70">Tees</p>
                      <div className="flex items-center gap-sm">
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white/30"
                          style={{ backgroundColor: getTeeColor(selectedTee.name, selectedTee.color) }}
                        />
                        <p className="text-body font-semibold text-white drop-shadow-md">{selectedTee.name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Date Selection Card */}
                <Card>
                  <CardContent className="p-lg">
                    <p className="text-caption text-muted mb-1">Date</p>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
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
          </>
        ) : (
          <Card>
            <CardContent className="p-xl text-center">
              <p className="text-muted">Course not found</p>
              <Button
                className="mt-lg"
                onClick={() => router.push("/courses?select=round")}
              >
                Select a Course
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
