"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, Button, Avatar } from "@/components/ui";
import { api, type Buddy } from "@/lib/api";
import { toast } from "sonner";

interface CreateGroupSheetProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
  buddies: Buddy[];
}

export function CreateGroupSheet({ open, onClose, onGroupCreated, buddies }: CreateGroupSheetProps) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBuddyIds, setSelectedBuddyIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleBuddy = (buddyUserId: string) => {
    setSelectedBuddyIds((prev) =>
      prev.includes(buddyUserId)
        ? prev.filter((id) => id !== buddyUserId)
        : [...prev, buddyUserId]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getToken();
      if (!token) return;

      await api.createGroup(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: selectedBuddyIds,
      });

      toast.success("Group created!");
      resetForm();
      onGroupCreated();
    } catch (error) {
      console.error("Failed to create group:", error);
      toast.error("Failed to create group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedBuddyIds([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-lg">
          <SheetTitle>Create Group</SheetTitle>
        </SheetHeader>

        <div className="space-y-lg">
          {/* Group Name */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Group Name
            </label>
            <input
              type="text"
              placeholder="Saturday Morning Crew"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-md rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
            />
          </div>

          {/* Description (optional) */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Description (optional)
            </label>
            <textarea
              placeholder="Regular Saturday tee time at Pebble Beach"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-md py-sm rounded-xl glass-card border-white/10 text-body text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all resize-none"
            />
          </div>

          {/* Add Members */}
          <div>
            <label className="text-sm font-medium text-muted block mb-sm">
              Add Members
            </label>
            {buddies.length > 0 ? (
              <div className="space-y-sm max-h-60 overflow-y-auto">
                {buddies.map((buddy) => {
                  const isSelected = selectedBuddyIds.includes(buddy.user.id);
                  return (
                    <button
                      key={buddy.id}
                      type="button"
                      onClick={() => handleToggleBuddy(buddy.user.id)}
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
                      <span className="flex-1 text-left font-medium">
                        {buddy.nickname || buddy.user.displayName || buddy.user.firstName || "Unknown"}
                      </span>
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
            ) : (
              <p className="text-muted text-sm">No buddies to add. Create the group first, then add members.</p>
            )}
          </div>

          {/* Selected count */}
          {selectedBuddyIds.length > 0 && (
            <p className="text-sm text-muted">
              {selectedBuddyIds.length} {selectedBuddyIds.length === 1 ? "member" : "members"} selected (plus you)
            </p>
          )}

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
