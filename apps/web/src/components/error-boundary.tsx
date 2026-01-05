"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-lg">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-lg">
          <div className="p-md rounded-full bg-error/10">
            <AlertTriangle className="h-12 w-12 text-error" />
          </div>
        </div>

        <h1 className="text-h1 font-bold mb-md">Something went wrong</h1>
        <p className="text-muted mb-lg">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>

        {error.digest && (
          <p className="text-caption text-subtle mb-lg font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-md justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.location.href = "/"}
          >
            <Home className="h-4 w-4 mr-2" />
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

// Compact error display for inline use
interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="p-lg text-center">
      <div className="flex justify-center mb-md">
        <AlertTriangle className="h-8 w-8 text-error" />
      </div>
      <p className="text-muted mb-md">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}
