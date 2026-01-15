"use client";

import { SectionHeader } from "@/components/ui";
import { ChallengeCard } from "./challenge-card";
import { type ChallengesResponse } from "@/lib/api";

interface ChallengesListProps {
  challenges: ChallengesResponse;
  onChallengeUpdated: () => void;
}

export function ChallengesList({ challenges, onChallengeUpdated }: ChallengesListProps) {
  return (
    <div className="space-y-lg">
      {/* Pending Challenges */}
      {challenges.pending.length > 0 && (
        <div>
          <SectionHeader title={`Pending (${challenges.pending.length})`} />
          <div className="space-y-md">
            {challenges.pending.map((challenge, index) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                index={index}
                onUpdated={onChallengeUpdated}
              />
            ))}
          </div>
        </div>
      )}

      {/* Accepted Challenges (ready to play) */}
      {challenges.accepted.length > 0 && (
        <div>
          <SectionHeader title={`Upcoming (${challenges.accepted.length})`} />
          <div className="space-y-md">
            {challenges.accepted.map((challenge, index) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                index={index}
                onUpdated={onChallengeUpdated}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed/Declined/Expired Challenges */}
      {challenges.completed.length > 0 && (
        <div>
          <SectionHeader title="History" />
          <div className="space-y-md">
            {challenges.completed.slice(0, 5).map((challenge, index) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                index={index}
                onUpdated={onChallengeUpdated}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
