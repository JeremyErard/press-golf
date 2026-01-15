"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Search, ChevronRight, UserPlus, Users, Swords } from "lucide-react";
import { Card, CardContent, Skeleton, Avatar, EmptyState, FAB, Tabs, TabsList, TabsTrigger, TabsContent, Badge } from "@/components/ui";
import { Header } from "@/components/layout/header";
import { api, type Buddy, type Group, type ChallengesResponse } from "@/lib/api";
import { BuddyDetailSheet } from "@/components/buddies/buddy-detail-sheet";
import { AddBuddySheet } from "@/components/buddies/add-buddy-sheet";
import { HeadToHeadBadge } from "@/components/buddies/head-to-head-badge";
import { GroupCard } from "@/components/groups/group-card";
import { CreateGroupSheet } from "@/components/groups/create-group-sheet";
import { ChallengesList } from "@/components/challenges/challenges-list";
import { CreateChallengeSheet } from "@/components/challenges/create-challenge-sheet";

export default function BuddiesPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("buddies");

  // Buddies state
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [buddiesLoading, setBuddiesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuddy, setSelectedBuddy] = useState<Buddy | null>(null);
  const [showAddBuddySheet, setShowAddBuddySheet] = useState(false);

  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showCreateGroupSheet, setShowCreateGroupSheet] = useState(false);

  // Challenges state
  const [challenges, setChallenges] = useState<ChallengesResponse | null>(null);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showCreateChallengeSheet, setShowCreateChallengeSheet] = useState(false);

  const fetchBuddies = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getBuddies(token);
      setBuddies(data);
    } catch (error) {
      console.error("Failed to fetch buddies:", error);
    } finally {
      setBuddiesLoading(false);
    }
  }, [getToken]);

  const fetchGroups = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.getGroups(token);
      setGroups(data);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    } finally {
      setGroupsLoading(false);
    }
  }, [getToken]);

  const fetchChallenges = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const [challengesData, countData] = await Promise.all([
        api.getChallenges(token),
        api.getPendingChallengeCount(token),
      ]);
      setChallenges(challengesData);
      setPendingCount(countData.count);
    } catch (error) {
      console.error("Failed to fetch challenges:", error);
    } finally {
      setChallengesLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchBuddies();
    fetchGroups();
    fetchChallenges();
  }, [fetchBuddies, fetchGroups, fetchChallenges]);

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
    setShowAddBuddySheet(false);
  };

  const handleGroupCreated = () => {
    fetchGroups();
    setShowCreateGroupSheet(false);
  };

  const handleChallengeCreated = () => {
    fetchChallenges();
    setShowCreateChallengeSheet(false);
  };

  const handleChallengeUpdated = () => {
    fetchChallenges();
  };

  return (
    <div className="pb-24">
      <Header title="Buddies" />

      <div className="p-lg space-y-lg">
        {/* Tabs */}
        <Tabs defaultValue="buddies" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="buddies">Buddies</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="challenges" className="relative">
              Challenges
              {pendingCount > 0 && (
                <Badge variant="error" className="ml-1.5 h-5 min-w-5 px-1 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Buddies Tab */}
          <TabsContent value="buddies">
            {/* Search */}
            <div className="relative mb-lg">
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
            {buddiesLoading ? (
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
                            <HeadToHeadBadge opponentId={buddy.user.id} compact />
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
                  onClick: () => setShowAddBuddySheet(true),
                  icon: <Plus className="h-4 w-4 mr-2" />,
                }}
              />
            )}
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups">
            {groupsLoading ? (
              <div className="space-y-md">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : groups.length > 0 ? (
              <div className="space-y-md">
                {groups.map((group, index) => (
                  <GroupCard key={group.id} group={group} index={index} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users className="w-20 h-20 text-brand/50" />}
                title="No groups yet"
                description="Create a group for your regular playing buddies"
                action={{
                  label: "Create Group",
                  onClick: () => setShowCreateGroupSheet(true),
                  icon: <Plus className="h-4 w-4 mr-2" />,
                }}
              />
            )}
          </TabsContent>

          {/* Challenges Tab */}
          <TabsContent value="challenges">
            {challengesLoading ? (
              <div className="space-y-md">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : challenges && (challenges.pending.length > 0 || challenges.accepted.length > 0 || challenges.completed.length > 0) ? (
              <ChallengesList
                challenges={challenges}
                onChallengeUpdated={handleChallengeUpdated}
              />
            ) : (
              <EmptyState
                icon={<Swords className="w-20 h-20 text-brand/50" />}
                title="No challenges yet"
                description="Challenge a buddy to a round and settle the score"
                action={{
                  label: "Send Challenge",
                  onClick: () => setShowCreateChallengeSheet(true),
                  icon: <Plus className="h-4 w-4 mr-2" />,
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* FAB - changes based on active tab */}
      <FAB
        onClick={() => {
          if (activeTab === "buddies") setShowAddBuddySheet(true);
          else if (activeTab === "groups") setShowCreateGroupSheet(true);
          else if (activeTab === "challenges") setShowCreateChallengeSheet(true);
        }}
        label={
          activeTab === "buddies"
            ? "Add a buddy"
            : activeTab === "groups"
            ? "Create group"
            : "Send challenge"
        }
        show={
          activeTab === "buddies"
            ? buddies.length > 0
            : activeTab === "groups"
            ? groups.length > 0
            : (challenges?.pending.length ?? 0) + (challenges?.accepted.length ?? 0) + (challenges?.completed.length ?? 0) > 0
        }
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
        open={showAddBuddySheet}
        onClose={() => setShowAddBuddySheet(false)}
        onBuddyAdded={handleBuddyAdded}
      />

      {/* Create Group Sheet */}
      <CreateGroupSheet
        open={showCreateGroupSheet}
        onClose={() => setShowCreateGroupSheet(false)}
        onGroupCreated={handleGroupCreated}
        buddies={buddies}
      />

      {/* Create Challenge Sheet */}
      <CreateChallengeSheet
        open={showCreateChallengeSheet}
        onClose={() => setShowCreateChallengeSheet(false)}
        onChallengeCreated={handleChallengeCreated}
        buddies={buddies}
      />
    </div>
  );
}
