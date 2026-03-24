"use client";

import { Suspense } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { PendingClaimSync } from "@/components/auth/PendingClaimSync";

// Validate required env vars at module load
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!convexUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_CONVEX_URL environment variable. " +
    "Set it in .env.local to your Convex deployment URL."
  );
}
if (!clerkKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable. " +
    "Set it in .env.local to your Clerk publishable key."
  );
}

const convex = new ConvexReactClient(convexUrl);

function InnerProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <Suspense fallback={null}>
        <PendingClaimSync />
      </Suspense>
      {children}
    </ConvexProviderWithClerk>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={clerkKey}>
      <InnerProviders>{children}</InnerProviders>
    </ClerkProvider>
  );
}
