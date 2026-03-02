import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Clerk middleware for server-side authentication.
 * 
 * This runs at the edge before pages render, ensuring auth is checked
 * server-side (not just client-side via AuthBlockerModal).
 * 
 * Public routes: None - all routes require authentication
 * To make routes public, add them to isPublicRoute matcher below.
 */

// Routes that don't require authentication
// Add paths here if you need public pages (e.g., landing page, marketing)
const isPublicRoute = createRouteMatcher([
  // "/sign-in(.*)",
  // "/sign-up(.*)",
  // "/", // Uncomment to make home page public
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
