"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Play, Plus, Trash2, UserMinus } from "lucide-react";
import {
  Card,
  CardContent,
  Skeleton,
  Avatar,
  Button,
  Badge,
  SectionHeader,
  EmptyState,
} from "@/components/ui";
import { api, type GroupDetail, type GroupLeaderboard, type GroupRound, type Buddy } from "@/lib/api";
import { toast } from "sonner";
import { AddMemberSheet } from "@/components/groups/add-member-sheet";
import { formatGameType } from "@/lib/game-utils";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken, userId } = useAuth();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboard | null>(null);
  const [rounds, setRounds] = useState<GroupRound[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddMemberSheet, setShowAddMemberSheet] = useState(false);

  const isOwner = group?.createdById === userId;

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const [groupData, leaderboardData, roundsData, buddiesData] = await Promise.all([
        api.getGroup(token, groupId),
        api.getGroupLeaderboard(token, groupId),
        api.getGroupRounds(token, groupId, 5),
        api.getBuddies(token),
      ]);

      setGroup(groupData);
      setLeaderboard(leaderboardData);
      setRounds(roundsData);
      setBuddies(buddiesData);
    } catch (error) {
      console.error("Failed to fetch group:", error);
      toast.error("Failed to load group");
    } finally {
      setIsLoading(false);
    }
  }, [getToken, groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartRound = () => {
    router.push(`/rounds/new?groupId=${groupId}`);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the group?")) return;

    try {
      const token = await getToken();
      if (!token) return;

      await api.removeGroupMember(token, groupId, memberId);
      toast.success("Member removed");
      fetchData();
    } catch (error) {
      console.error("Failed to remove member:", error);
      toast.error("Failed to remove member");
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Delete this group? This action cannot be undone.")) return;

    try {
      const token = await getToken();
      if (!token) return;

      await api.deleteGroup(token, groupId);
      toast.success("Group deleted");
      router.push("/buddies");
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast.error("Failed to delete group");
    }
  };

  const handleMemberAdded = () => {
    fetchData();
    setShowAddMemberSheet(false);
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `${rank}.`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="pb-24">
        <div className="p-lg">
          <Skeleton className="h-8 w-48 mb-lg" />
          <Skeleton className="h-12 w-full mb-lg" />
          <Skeleton className="h-64 w-full mb-lg" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="pb-24 p-lg">
        <EmptyState
          title="Group not found"
          description="This group may have been deleted"
          action={{
            label: "Go Back",
            onClick: () => router.push("/buddies"),
          }}
        />
      </div>
    );
  }

  // Filter out members already in the group from buddies
  const memberUserIds = group.members.map((m) => m.userId);
  const availableBuddies = buddies.filter((b) => !memberUserIds.includes(b.user.id));

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-md p-lg">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-muted truncate">{group.description}</p>
            )}
          </div>
          {isOwner && (
            <button
              onClick={handleDeleteGroup}
              className="p-2 rounded-full hover:bg-error/20 text-muted hover:text-error transition-colors"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-lg space-y-lg">
        {/* Start Round CTA */}
        <Button className="w-full" onClick={handleStartRound}>
          <Play className="h-5 w-5 mr-2" />
          Start Round with Group
        </Button>

        {/* Leaderboard */}
        <Card className="glass-card">
          <CardContent className="p-md">
            <SectionHeader title="Leaderboard" className="mb-md" />

            {leaderboard && leaderboard.members.length > 0 ? (
              <div className="space-y-sm">
                {leaderboard.members.map((member) => (
                  <div
                    key={member.userId}
                    className={`flex items-center gap-md p-sm rounded-xl ${
                      member.rank <= 3 ? "bg-surface" : ""
                    }`}
                  >
                    <span className="w-8 text-lg">{getMedalEmoji(member.rank)}</span>
                    <Avatar
                      className="h-8 w-8"
                      src={member.avatarUrl}
                      name={member.displayName || "?"}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.displayName}</p>
                      <p className="text-xs text-muted">
                        {member.roundsPlayed} {member.roundsPlayed === 1 ? "round" : "rounds"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          member.netEarnings > 0
                            ? "text-success"
                            : member.netEarnings < 0
                            ? "text-error"
                            : "text-muted"
                        }`}
                      >
                        {member.netEarnings >= 0 ? "+" : ""}${member.netEarnings.toFixed(0)}
                      </p>
                      <p className="text-xs text-muted">
                        {member.wins}W-{member.losses}L
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted py-md">
                Play some rounds to build the leaderboard!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="glass-card">
          <CardContent className="p-md">
            <div className="flex items-center justify-between mb-md">
              <SectionHeader title={`Members (${group.members.length})`} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddMemberSheet(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-sm">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-md p-sm rounded-xl"
                >
                  <Avatar
                    className="h-10 w-10"
                    src={member.user.avatarUrl}
                    name={member.user.displayName || member.user.firstName || "?"}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.user.displayName || member.user.firstName || "Unknown"}
                      {member.userId === userId && (
                        <span className="text-muted text-sm ml-1">(You)</span>
                      )}
                    </p>
                    {member.user.handicapIndex !== undefined && member.user.handicapIndex !== null && (
                      <p className="text-xs text-muted">HCP: {member.user.handicapIndex}</p>
                    )}
                  </div>
                  {member.role === "OWNER" ? (
                    <Badge variant="brand">Owner</Badge>
                  ) : (
                    isOwner &&
                    member.userId !== userId && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 rounded-full hover:bg-error/20 text-muted hover:text-error transition-colors"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Rounds */}
        <Card className="glass-card">
          <CardContent className="p-md">
            <SectionHeader title="Recent Rounds" className="mb-md" />

            {rounds.length > 0 ? (
              <div className="space-y-sm">
                {rounds.map((round) => (
                  <button
                    key={round.id}
                    onClick={() => router.push(`/rounds/${round.id}`)}
                    className="w-full flex items-center gap-md p-sm rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <p className="font-medium">{round.course.name}</p>
                      <p className="text-xs text-muted">
                        {formatDate(round.date)} • {round.playerCount} players
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {round.games.slice(0, 2).map((game, i) => (
                        <Badge key={i} variant="default" className="text-xs">
                          ${game.betAmount} {formatGameType(game.type)}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted py-md">No rounds played yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Member Sheet */}
      <AddMemberSheet
        open={showAddMemberSheet}
        onClose={() => setShowAddMemberSheet(false)}
        onMemberAdded={handleMemberAdded}
        groupId={groupId}
        availableBuddies={availableBuddies}
      />
    </div>
  );
}
