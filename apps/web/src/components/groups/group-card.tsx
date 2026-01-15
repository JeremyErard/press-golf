"use client";

import { ChevronRight, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, Avatar } from "@/components/ui";
import { type Group } from "@/lib/api";

interface GroupCardProps {
  group: Group;
  index?: number;
}

export function GroupCard({ group, index = 0 }: GroupCardProps) {
  const router = useRouter();

  const memberCount = group._count?.members ?? group.members.length;
  const roundCount = group._count?.rounds ?? 0;

  // Show first 3 member avatars
  const displayMembers = group.members.slice(0, 3);
  const extraMembers = memberCount - 3;

  return (
    <Card
      className="glass-card cursor-pointer hover:bg-white/5 transition-colors animate-fade-in-up"
      style={{ animationDelay: `${index * 30}ms` }}
      onClick={() => router.push(`/groups/${group.id}`)}
    >
      <CardContent className="p-md">
        <div className="flex items-center gap-md">
          {/* Group icon or stacked avatars */}
          <div className="relative flex-shrink-0">
            {displayMembers.length > 0 ? (
              <div className="flex -space-x-2">
                {displayMembers.map((member, i) => (
                  <Avatar
                    key={member.id}
                    className="h-10 w-10 border-2 border-background"
                    style={{ zIndex: displayMembers.length - i }}
                    src={member.user.avatarUrl}
                    name={member.user.displayName || member.user.firstName || "?"}
                  />
                ))}
                {extraMembers > 0 && (
                  <div
                    className="h-10 w-10 rounded-full bg-surface border-2 border-background flex items-center justify-center text-xs font-medium text-muted"
                    style={{ zIndex: 0 }}
                  >
                    +{extraMembers}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-12 w-12 rounded-full bg-surface flex items-center justify-center">
                <Users className="h-6 w-6 text-muted" />
              </div>
            )}
          </div>

          {/* Group info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{group.name}</p>
            <p className="text-sm text-muted">
              {memberCount} {memberCount === 1 ? "member" : "members"}
              {roundCount > 0 && ` • ${roundCount} ${roundCount === 1 ? "round" : "rounds"}`}
            </p>
          </div>

          <ChevronRight className="h-5 w-5 text-muted flex-shrink-0" />
        </div>

        {/* Description if present */}
        {group.description && (
          <p className="text-sm text-muted mt-sm line-clamp-1">{group.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
