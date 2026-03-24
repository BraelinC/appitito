"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Header } from "@/components/Header";
import { CookbookGrid } from "@/components/cookbook/CookbookGrid";
import { BillingModal } from "@/components/billing/BillingModal";

export function HomeClient() {
  const searchParams = useSearchParams();
  const [billingOpen, setBillingOpen] = useState(searchParams.get("billing") === "1");

  const { isLoaded, user } = useUser();

  // Query onboarding status based on delivered recipe count
  const onboardingStatus = useQuery(
    api.instagramAuth.getOnboardingStatus,
    isLoaded && user?.id ? { clerkUserId: user.id } : "skip"
  );

  // Show onboarding overlay if:
  // - User is logged in
  // - User is linked to Instagram
  // - User has 0 delivered recipes
  const showOnboarding = onboardingStatus?.showOnboarding === true;

  // Anonymous users see the landing page
  if (isLoaded && !user) {
    return <AnonymousLanding />;
  }

  return (
    <main className="min-h-screen">
      <BillingModal open={billingOpen} onOpenChange={setBillingOpen} />
      <Header />
      <CookbookGrid />
      {showOnboarding ? <OnboardingState /> : null}
    </main>
  );
}

function AnonymousLanding() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-8"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-md rounded-[2rem] border px-6 py-8 text-center shadow-[0_18px_50px_var(--shadow-warm)]"
        style={{ backgroundColor: "var(--panel)", borderColor: "var(--line)" }}
      >
        <p className="text-xs uppercase tracking-[0.28em]" style={{ color: "var(--ink-muted)" }}>
          Appetito
        </p>

        {/* Video placeholder - replace src with your screen recording */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-black">
          <video
            className="w-full"
            autoPlay
            loop
            muted
            playsInline
            poster="/video-poster.jpg"
          >
            <source src="/demo.mp4" type="video/mp4" />
          </video>
        </div>

        <h2 className="mt-6 font-display text-2xl leading-tight" style={{ color: "var(--ink)" }}>
          Send me a reel
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
          DM any cooking reel to my Instagram and I&apos;ll turn it into a recipe for you.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="https://ig.me/m/appitito"
            className="inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "#fff" }}
          >
            Open Instagram DM
          </Link>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Or search @appitito on Instagram and send any cooking reel
          </p>
        </div>
      </div>
    </main>
  );
}

function OnboardingState() {
  return (
    <section className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-4 py-8 sm:px-6">
      <div className="absolute inset-0 bg-[rgba(248,244,238,0.7)] backdrop-blur-sm" />
      <div
        className="pointer-events-auto relative mx-auto w-full max-w-xl rounded-[2rem] border px-6 py-10 text-center shadow-[0_18px_50px_var(--shadow-warm)]"
        style={{ backgroundColor: "var(--panel)", borderColor: "var(--line)" }}
      >
        <p className="text-xs uppercase tracking-[0.28em]" style={{ color: "var(--ink-muted)" }}>
          Appetito
        </p>
        <h2 className="mt-3 font-display text-3xl leading-tight" style={{ color: "var(--ink)" }}>
          You&apos;re in. Now go get hungry and DM me.
        </h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
          Head back to Instagram and send me a cooking reel, or use the test reel below.
        </p>

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
      </div>
    </section>
  );
}
