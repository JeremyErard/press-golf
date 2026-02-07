"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, Button, Avatar, EmptyState } from "@/components/ui";
import { api, type Buddy } from "@/lib/api";
import { toast } from "sonner";

interface AddMemberSheetProps {
  open: boolean;
  onClose: () => void;
  onMemberAdded: () => void;
  groupId: string;
  availableBuddies: Buddy[];
}

export function AddMemberSheet({
  open,
  onClose,
  onMemberAdded,
  groupId,
  availableBuddies,
}: AddMemberSheetProps) {
  const { getToken } = useAuth();
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedBuddyId) {
      toast.error("Please select a buddy to add");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.addGroupMember(token, groupId, selectedBuddyId);
      toast.success("Member added to group!");
      setSelectedBuddyId(null);
      onMemberAdded();
    } catch (error) {
      console.error("Failed to add member:", error);
      toast.error("Failed to add member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedBuddyId(null);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="h-[70vh] overflow-y-auto">
        <SheetHeader className="mb-lg">
          <SheetTitle>Add Member</SheetTitle>
        </SheetHeader>

        <div className="space-y-lg">
          {availableBuddies.length > 0 ? (
            <>
              <div className="space-y-sm max-h-80 overflow-y-auto">
                {availableBuddies.map((buddy) => {
                  const isSelected = selectedBuddyId === buddy.user.id;
                  return (
                    <button
                      key={buddy.id}
                      type="button"
                      onClick={() => setSelectedBuddyId(buddy.user.id)}
                      className={`w-full flex items-center gap-md p-md rounded-xl transition-colors ${
                        isSelected
                          ? "bg-brand/20 border border-brand/50"
                          : "glass-card hover:bg-white/5"
                      }`}
                    >
                      <Avatar
                        className="h-10 w-10"
                        src={buddy.user.avatarUrl}
                        name={buddy.nickname || buddy.user.displayName || buddy.user.firstName || "?"}
                      />
                      <div className="flex-1 text-left">
                        <p className="font-medium">
                          {buddy.nickname || buddy.user.displayName || buddy.user.firstName || "Unknown"}
                        </p>
                        {buddy.user.handicapIndex !== undefined && buddy.user.handicapIndex !== null && (
                          <p className="text-xs text-muted">HCP: {buddy.user.handicapIndex}</p>
                        )}
                      </div>
                      {isSelected ? (
                        <div className="h-6 w-6 rounded-full bg-brand flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full border border-white/20" />
                      )}
                    </button>
                  );
                })}
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedBuddyId}
              >
                {isSubmitting ? "Adding..." : "Add to Group"}
              </Button>
            </>
          ) : (
            <EmptyState
              icon={<UserPlus className="w-16 h-16 text-muted" />}
              title="No buddies to add"
              description="All your buddies are already in this group, or you haven't added any buddies yet."
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
