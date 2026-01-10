import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/join/(.*)", // Invite landing pages
  "/api/webhooks(.*)", // Webhook endpoints
]);

export default clerkMiddleware(async (auth, request) => {
  // If it's not a public route, require authentication
  if (!isPublicRoute(request)) {
    // Check if user has logged in before on this device (cookie-based)
    const hasLoggedInBefore = request.cookies.get("press_returning_user")?.value === "true";

    // Redirect to sign-in for returning users, sign-up for new users
    const authUrl = hasLoggedInBefore ? "/sign-in" : "/sign-up";

    await auth.protect({
      unauthenticatedUrl: new URL(authUrl, request.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
