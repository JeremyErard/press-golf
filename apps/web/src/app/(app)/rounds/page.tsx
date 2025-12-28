"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { Button, Card, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from "@/components/ui";
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

export default function RoundsPage() {
  const { getToken } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ACTIVE" | "COMPLETED">("all");

  useEffect(() => {
    async function fetchRounds() {
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.getRounds(token);
        setRounds(data);
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
    <div>
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
            {filteredRounds.map((round, index) => (
              <div
                key={round.id}
                
                
                
              >
                <Link href={`/rounds/${round.id}`}>
                  <Card className="card-hover">
                    <CardContent className="p-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-xs">
                          <Badge variant={statusBadgeVariant[round.status]}>
                            {statusLabel[round.status]}
                          </Badge>
                          <p className="text-body font-medium">
                            {formatDate(round.date)}
                          </p>
                          <p className="text-caption text-muted">
                            {round._count?.players || 0} players
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
          <Card>
            <CardContent className="p-xl text-center">
              <p className="text-muted">No rounds found</p>
              <p className="text-caption text-subtle mt-xs">
                {filter === "all"
                  ? "Start a new round to get going!"
                  : `No ${filter.toLowerCase()} rounds`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* FAB */}
      <Link
        href="/rounds/new"
        className="fixed bottom-24 right-lg z-40"
      >
        <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}
