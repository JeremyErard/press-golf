"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, ChevronRight, Flag } from "lucide-react";
import { Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, Skeleton, EmptyState, FAB } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { api, type Round } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusBadgeVariant = {
  SETUP: "warning" as const,
  ACTIVE: "success" as const,
  COMPLETED: "default" as const,
};

const statusLabel = {
  SETUP: "Setup",
  ACTIVE: "Active",
  COMPLETED: "Completed",
};

interface RoundWithCourse extends Round {
  courseName?: string;
}

export default function RoundsPage() {
  const { getToken } = useAuth();
  const [rounds, setRounds] = useState<RoundWithCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ACTIVE" | "COMPLETED">("all");

  useEffect(() => {
    async function fetchRounds() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getRounds(token);

        // Fetch course names for each round
        const roundsWithCourse: RoundWithCourse[] = await Promise.all(
          data.map(async (round) => {
            try {
              const detail = await api.getRound(token, round.id);
              return { ...round, courseName: detail.course.name };
            } catch {
              return round;
            }
          })
        );

        setRounds(roundsWithCourse);
      } catch (error) {
        console.error("Failed to fetch rounds:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRounds();
  }, [getToken]);

  const filteredRounds = filter === "all"
    ? rounds
    : rounds.filter((r) => r.status === filter);

  return (
    <div className="pb-24">
      <Header title="Rounds" />

      <div className="p-lg space-y-lg">
        {/* Tabs */}
        <Tabs defaultValue="all" onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="ACTIVE" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="COMPLETED" className="flex-1">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Rounds List */}
        {isLoading ? (
          <div className="space-y-md">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredRounds.length > 0 ? (
          <div
            className="space-y-md"
            
            
          >
            {filteredRounds.map((round, _index) => (
              <div
                key={round.id}
                
                
                
              >
                <Link href={`/rounds/${round.id}`}>
                  <Card className="glass-card-hover animate-fade-in-up" style={{ animationDelay: `${_index * 50}ms` }}>
                    <CardContent className="p-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-xs">
                          <Badge
                            variant={statusBadgeVariant[round.status]}
                            className={round.status === "ACTIVE" ? "pulse-active" : ""}
                          >
                            {statusLabel[round.status]}
                          </Badge>
                          <p className="text-body font-medium">
                            {round.courseName || formatDate(round.date)}
                          </p>
                          <p className="text-caption text-muted">
                            {formatDate(round.date)} • {round._count?.players || 0} player{(round._count?.players || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Flag className="h-8 w-8" />}
            title="No rounds found"
            description={
              filter === "all"
                ? "Start a new round to get going!"
                : `No ${filter.toLowerCase()} rounds yet`
            }
            action={filter === "all" ? {
              label: "Start a Round",
              href: "/rounds/new",
              icon: <Plus className="h-4 w-4 mr-2" />,
            } : undefined}
          />
        )}
      </div>

      <FAB href="/rounds/new" label="Start a new round" />
    </div>
  );
}
