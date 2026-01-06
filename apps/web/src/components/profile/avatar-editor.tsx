"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Camera } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Avatar,
  Button,
} from "@/components/ui";
import { ImageCapture } from "@/components/image-capture";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface AvatarEditorProps {
  currentAvatarUrl?: string | null;
  displayName?: string | null;
  onAvatarUpdated: (newUrl: string) => void;
}

export function AvatarEditor({
  currentAvatarUrl,
  displayName,
  onAvatarUpdated,
}: AvatarEditorProps) {
  const { getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelected = useCallback((file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
  }, [previewUrl]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const result = await api.uploadAvatar(token, selectedFile);
      onAvatarUpdated(result.avatarUrl);
      toast.success("Profile photo updated!");
      setIsOpen(false);
      handleClear();
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      setError("Failed to upload photo. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      handleClear();
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Clickable Avatar */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative group cursor-pointer"
        aria-label="Edit profile photo"
      >
        <Avatar
          src={currentAvatarUrl || undefined}
          name={displayName || "User"}
          size="lg"
          className="ring-2 ring-border group-hover:ring-brand transition-all w-20 h-20"
        />
        {/* Camera overlay */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="h-8 w-8 text-white" />
        </div>
        {/* Edit badge */}
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand flex items-center justify-center border-2 border-background">
          <Camera className="h-4 w-4 text-white" />
        </div>
      </button>

      {/* Editor Sheet */}
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Profile Photo</SheetTitle>
            <SheetDescription>
              Take a new photo or choose from your library
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-6 space-y-lg">
            {/* Current/Preview Avatar */}
            <div className="flex justify-center">
              <Avatar
                src={previewUrl || currentAvatarUrl || undefined}
                name={displayName || "User"}
                size="lg"
                className="w-32 h-32 text-3xl"
              />
            </div>

            {/* Image Capture */}
            {!previewUrl && (
              <ImageCapture
                capture="user"
                onImageSelected={handleImageSelected}
                onClear={handleClear}
                showPreview={false}
                cameraLabel="Take Photo"
                galleryLabel="Choose from Library"
              />
            )}

            {/* Actions when preview exists */}
            {previewUrl && (
              <div className="space-y-sm">
                {error && (
                  <p className="text-error text-caption text-center">{error}</p>
                )}
                <Button
                  onClick={handleUpload}
                  isLoading={isUploading}
                  className="w-full"
                >
                  Save Photo
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleClear}
                  disabled={isUploading}
                  className="w-full"
                >
                  Retake
                </Button>
              </div>
            )}

            {/* Cancel button */}
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isUploading}
              className="w-full text-muted"
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
