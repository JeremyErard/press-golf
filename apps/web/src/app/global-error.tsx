"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-full bg-red-500/10">
                <AlertTriangle className="h-12 w-12 text-red-500" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-4">
              Critical Error
            </h1>
            <p className="text-gray-400 mb-6">
              Something went wrong at the application level.
              Please try refreshing the page.
            </p>

            {error.digest && (
              <p className="text-xs text-gray-500 mb-6 font-mono">
                Error ID: {error.digest}
              </p>
            )}

            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
