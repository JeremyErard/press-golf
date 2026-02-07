"use client";

import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleHome = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-lg bg-background">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-lg">
          <div className="p-md rounded-full bg-warning/10">
            <WifiOff className="h-12 w-12 text-warning" />
          </div>
        </div>

        <h1 className="text-h1 font-bold mb-md text-foreground">
          You&apos;re Offline
        </h1>
        <p className="text-muted mb-lg">
          It looks like you&apos;ve lost your internet connection.
          Don&apos;t worry, your scores will sync when you&apos;re back online.
        </p>

        <div className="flex flex-col sm:flex-row gap-md justify-center">
          <Button onClick={handleRetry} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={handleHome} variant="secondary">
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>

        <p className="text-caption text-subtle mt-xl">
          Press works best with an internet connection, but we&apos;ll save
          your progress locally and sync it when you reconnect.
        </p>
      </div>
    </div>
  );
}
