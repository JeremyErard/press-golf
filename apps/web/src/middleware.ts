import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",              // Public landing page
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/join/(.*)",     // Invite landing pages
  "/offline",       // PWA offline fallback
  "/manifest.json", // PWA manifest
  "/api/webhooks(.*)", // Webhook endpoints
  "/sitemap.xml",   // SEO sitemap
  "/robots.txt",    // SEO robots
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  // If user is authenticated and on the landing page, redirect to dashboard
  if (userId && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If it's not a public route, require authentication
  if (!isPublicRoute(request)) {
    // Default to sign-in for all unauthenticated users
    // This is better UX since returning users are more common,
    // and new users can easily click "Sign up" from the sign-in page
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", request.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files (including sitemap.xml, robots.txt)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
