"use client";

import Image from "next/image";
import { useState } from "react";

interface CourseImageProps {
  courseName: string;
  className?: string;
  showOverlay?: boolean;
}

// Generate a gradient based on course name for visual variety
function getGradientFromName(name: string): string {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    "from-emerald-900 via-green-800 to-emerald-950",
    "from-green-900 via-emerald-800 to-green-950",
    "from-teal-900 via-green-800 to-teal-950",
    "from-cyan-900 via-teal-800 to-cyan-950",
    "from-green-800 via-emerald-700 to-green-900",
  ];
  return gradients[hash % gradients.length];
}

// Get initials from course name (max 3 chars)
function getInitials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(word => word.length > 0 && word[0].match(/[A-Za-z]/))
    .slice(0, 3)
    .map(word => word[0].toUpperCase())
    .join("");
}

export function CourseImage({ courseName, className = "", showOverlay = true }: CourseImageProps) {
  const [imageError, setImageError] = useState(false);
  const gradient = getGradientFromName(courseName);
  const initials = getInitials(courseName);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Try to load the hero image, fallback to gradient */}
      {!imageError ? (
        <Image
          src="/images/golf-hero.jpg"
          alt={courseName}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Golf course pattern overlay */}
      <div className="absolute inset-0 opacity-20">
        <svg width="100%" height="100%" className="text-white/10">
          <pattern id="golfPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="2" fill="currentColor" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#golfPattern)" />
        </svg>
      </div>

      {/* Gradient overlay for text readability */}
      {showOverlay && (
        <div className="absolute inset-0 course-image-overlay" />
      )}

      {/* Course initials watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white/10 text-6xl font-black tracking-tighter">
          {initials}
        </span>
      </div>
    </div>
  );
}

// Smaller thumbnail version for cards
export function CourseThumbnail({ courseName, className = "" }: Omit<CourseImageProps, "showOverlay">) {
  const gradient = getGradientFromName(courseName);
  const initials = getInitials(courseName);

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

      {/* Subtle flag icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="absolute inset-0 w-full h-full p-2 text-white/10"
      >
        <path
          d="M4 21V4M4 4L14 8L4 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Initials */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white/30 text-sm font-bold">
          {initials}
        </span>
      </div>
    </div>
  );
}
