"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { clearPendingClaimToken, getPendingClaimToken, setPendingClaimToken } from "@/components/auth/pendingClaim";

export function PendingClaimSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const claimingRef = useRef(false);

  useEffect(() => {
    const authToken = searchParams.get("auth");
    if (authToken) {
      setPendingClaimToken(authToken);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || claimingRef.current) {
      return;
    }

    const token = getPendingClaimToken();
    if (!token) {
      return;
    }

    claimingRef.current = true;

    void (async () => {
      try {
        const response = await fetch("/api/dm-auth/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (response.ok) {
          clearPendingClaimToken();
          if (pathname.startsWith("/claim")) {
            router.replace("/?claimed=1");
          } else {
            router.refresh();
          }
          return;
        }

        const result = await response.json().catch(() => null) as { error?: string } | null;
        if (result?.error?.includes("already been claimed") || result?.error?.includes("Invalid token")) {
          clearPendingClaimToken();
          if (pathname.startsWith("/claim")) {
            router.replace("/");
          }
        }
      } catch (error) {
        console.error("Failed to sync pending claim token:", error);
      } finally {
        claimingRef.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, pathname, router]);

  return null;
}
