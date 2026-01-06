import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-lg">
      <div className="text-center space-y-lg max-w-md">
        {/* Golf ball icon */}
        <div className="w-24 h-24 mx-auto rounded-full bg-surface flex items-center justify-center">
          <svg
            className="w-12 h-12 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path
              strokeLinecap="round"
              strokeWidth="2"
              d="M12 6v2M9 8.5l1 1.5M15 8.5l-1 1.5"
            />
          </svg>
        </div>

        {/* Error message */}
        <div className="space-y-sm">
          <h1 className="text-6xl font-bold text-brand">404</h1>
          <h2 className="text-h2 font-semibold text-foreground">
            Lost in the rough
          </h2>
          <p className="text-body text-muted">
            Looks like this page took a bad bounce. Let&apos;s get you back on the fairway.
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex flex-col gap-sm pt-md">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-lg py-md bg-brand text-white rounded-lg font-medium hover:bg-brand/90 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Back to Home
          </Link>
          <Link
            href="/rounds"
            className="inline-flex items-center justify-center gap-2 px-lg py-md bg-surface text-foreground rounded-lg font-medium hover:bg-elevated transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
              />
            </svg>
            View Rounds
          </Link>
        </div>

        {/* Footer */}
        <p className="text-caption text-muted pt-xl">
          Press v1.0.0
        </p>
      </div>
    </div>
  );
}
