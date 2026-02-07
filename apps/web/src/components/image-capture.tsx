"use client";

import { useRef, useState, useCallback } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ImageCaptureProps {
  /** Camera facing mode: "user" for selfie, "environment" for back camera */
  capture?: "user" | "environment";
  /** Called when an image is selected */
  onImageSelected: (file: File) => void;
  /** Called when image is cleared */
  onClear?: () => void;
  /** Show preview after capture */
  showPreview?: boolean;
  /** Custom preview URL (e.g., current avatar) */
  previewUrl?: string | null;
  /** Loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Button label for camera */
  cameraLabel?: string;
  /** Button label for gallery */
  galleryLabel?: string;
  /** Additional className for container */
  className?: string;
  /** Whether to show both camera and gallery buttons */
  showBothOptions?: boolean;
  /** Accepted mime types */
  accept?: string;
}

export function ImageCapture({
  capture = "environment",
  onImageSelected,
  onClear,
  showPreview = true,
  previewUrl = null,
  isLoading = false,
  error = null,
  cameraLabel = "Take Photo",
  galleryLabel = "Choose from Library",
  className,
  showBothOptions = true,
  accept = "image/*",
}: ImageCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(previewUrl);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Create preview URL
        if (showPreview) {
          const url = URL.createObjectURL(file);
          setPreview(url);
        }
        onImageSelected(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [onImageSelected, showPreview]
  );

  const handleClear = useCallback(() => {
    if (preview && preview !== previewUrl) {
      URL.revokeObjectURL(preview);
    }
    setPreview(previewUrl);
    onClear?.();
  }, [preview, previewUrl, onClear]);

  const openCamera = () => cameraInputRef.current?.click();
  const openGallery = () => galleryInputRef.current?.click();

  return (
    <div className={cn("space-y-md", className)}>
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Camera capture"
      />
      {showBothOptions && (
        <input
          ref={galleryInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Gallery selection"
        />
      )}

      {/* Preview */}
      {showPreview && preview && (
        <div className="relative rounded-lg overflow-hidden bg-surface border border-border">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover"
          />
          {!isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background transition-colors"
              aria-label="Clear image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-error text-caption text-center">{error}</p>
      )}

      {/* Action buttons */}
      <div className={cn("flex gap-sm", showBothOptions ? "flex-col" : "")}>
        <Button
          type="button"
          variant="secondary"
          onClick={openCamera}
          disabled={isLoading}
          className="flex-1"
        >
          <Camera className="h-5 w-5" />
          {cameraLabel}
        </Button>

        {showBothOptions && (
          <Button
            type="button"
            variant="ghost"
            onClick={openGallery}
            disabled={isLoading}
            className="flex-1"
          >
            <ImagePlus className="h-5 w-5" />
            {galleryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
