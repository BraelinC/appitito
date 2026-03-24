"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { SignIn, useUser } from "@clerk/nextjs";
import { setPendingClaimToken } from "@/components/auth/pendingClaim";

export function ClaimClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const authToken = searchParams.get("auth");
  const [status] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (authToken) {
      setPendingClaimToken(authToken);
    }
  }, [authToken]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (isSignedIn && !authToken) {
      if (typeof window !== "undefined") {
        window.location.assign("/");
        return;
      }
      router.replace("/");
      return;
    }

    if (!isSignedIn || !authToken) {
      return;
    }
  }, [authToken, isLoaded, isSignedIn, router]);

  const currentUrl = authToken ? `/claim?auth=${encodeURIComponent(authToken)}` : "/claim";

  if (!isLoaded || (isSignedIn && status === "loading") || status === "success") {
    return null;
  }

  return (
    <main className="min-h-screen">
      <section className="px-4 pt-8 pb-12 sm:px-6">
        <div
          className="mx-auto max-w-xl rounded-[2rem] border px-6 py-10 text-center shadow-[0_18px_50px_var(--shadow-warm)]"
          style={{ backgroundColor: "var(--panel)", borderColor: "var(--line)" }}
        >
          <p className="text-xs uppercase tracking-[0.28em]" style={{ color: "var(--ink-muted)" }}>
            Appetito
          </p>
          {!isLoaded ? (
            <MinimalLoadingState />
          ) : !isSignedIn ? (
            <>
              <div className="mt-6 flex justify-center">
                <SignIn
                  key={authToken ?? "claim-signin"}
                  routing="hash"
                  forceRedirectUrl={currentUrl}
                  fallbackRedirectUrl={currentUrl}
                  appearance={{
                    elements: {
                      card: "shadow-none border-0 bg-transparent",
                      rootBox: "w-full",
                      header: "hidden",
                      footer: "hidden",
                      alert: "hidden",
                      alertText: "hidden",
                      alertTextContainer: "hidden",
                    },
                  }}
                />
              </div>
            </>
          ) : status === "loading" ? (
            <MinimalLoadingState />
          ) : (
            <>
              <h2 className="mt-3 font-display text-3xl leading-tight" style={{ color: "var(--ink)" }}>
                This link expired.
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                DM me RECIPE and I&apos;ll send you a fresh link.
              </p>
            </>
          )}

          {isLoaded && isSignedIn && status !== "loading" && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link
                href="https://linktw.in/cMlROV"
                className="inline-flex min-w-56 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--accent)", color: "#fff" }}
              >
                Feed me a test reel
              </Link>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
                If the reel does not jump into Instagram, just head back there and DM me any cooking reel.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function MinimalLoadingState() {
  return (
    <div className="flex justify-center py-8" aria-label="Loading">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
        style={{ borderTopColor: "var(--accent)", borderRightColor: "var(--accent-soft)" }}
      />
    </div>
  );
}
