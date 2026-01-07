"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Search, ChevronRight, UserPlus } from "lucide-react";
import { Card, CardContent, Skeleton, Avatar, Badge, EmptyState, FAB } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { api, type Buddy } from "@/lib/api";
import { BuddyDetailSheet } from "@/components/buddies/buddy-detail-sheet";
import { AddBuddySheet } from "@/components/buddies/add-buddy-sheet";

function getSourceLabel(sourceType: Buddy["sourceType"]): string {
  switch (sourceType) {
    case "INVITE":
      return "Via invite";
    case "ROUND":
      return "Played together";
    case "MANUAL":
      return "Added manually";
    default:
      return "";
  }
}

export default function BuddiesPage() {
  const { getToken } = useAuth();
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Sheet states
  const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const fetchBuddies = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getBuddies(token);
      setBuddies(data);
    } catch (error) {
      console.error("Failed to fetch buddies:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchBuddies();
  }, [fetchBuddies]);

  const filteredBuddies = searchQuery
    ? buddies.filter((b) => {
        const name = b.nickname || b.user.displayName || b.user.firstName || "";
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : buddies;

  const handleBuddyUpdated = () => {
    fetchBuddies();
    setSelectedBuddy(null);
  };

  const handleBuddyAdded = () => {
    fetchBuddies();
    setShowAddSheet(false);
  };

  return (
    <div className="pb-24">
      <Header title="Buddies" />

      <div className="p-lg space-y-lg">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-md top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
          <input
            type="text"
            placeholder="Search buddies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-md rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
          />
        </div>

        {/* Buddies List */}
        {isLoading ? (
          <div className="space-y-md">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredBuddies.length > 0 ? (
          <div className="space-y-md">
            {filteredBuddies.map((buddy, index) => (
              <Card
                key={buddy.id}
                className="glass-card cursor-pointer hover:bg-white/5 transition-colors animate-fade-in-up"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => setSelectedBuddy(buddy)}
              >
                <CardContent className="p-md">
                  <div className="flex items-center gap-md">
                    <Avatar
                      className="h-12 w-12"
                      src={buddy.user.avatarUrl}
                      name={buddy.nickname || buddy.user.displayName || buddy.user.firstName || "?"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {buddy.nickname || buddy.user.displayName || buddy.user.firstName || "Unknown"}
                      </p>
                      <div className="flex items-center gap-sm text-sm text-muted">
                        {buddy.user.handicapIndex !== undefined && buddy.user.handicapIndex !== null && (
                          <span>HCP: {buddy.user.handicapIndex}</span>
                        )}
                        <Badge variant="default" className="text-xs">
                          {getSourceLabel(buddy.sourceType)}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchQuery ? (
          <EmptyState
            icon={<Search className="w-16 h-16 text-muted" />}
            title="No buddies found"
            description="Try a different search or add a new buddy"
          />
        ) : (
          <EmptyState
            icon={<UserPlus className="w-20 h-20 text-brand/50" />}
            title="No buddies yet"
            description="Add buddies to quickly invite them to rounds"
            action={{
              label: "Add Buddy",
              onClick: () => setShowAddSheet(true),
              icon: <Plus className="h-4 w-4 mr-2" />,
            }}
          />
        )}
      </div>

      <FAB
        onClick={() => setShowAddSheet(true)}
        label="Add a buddy"
        show={buddies.length > 0}
      />

      {/* Buddy Detail Sheet */}
      <BuddyDetailSheet
        buddy={selectedBuddy}
        open={!!selectedBuddy}
        onClose={() => setSelectedBuddy(null)}
        onUpdated={handleBuddyUpdated}
      />

      {/* Add Buddy Sheet */}
      <AddBuddySheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onBuddyAdded={handleBuddyAdded}
      />
    </div>
  );
}
