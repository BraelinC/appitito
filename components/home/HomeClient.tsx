"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import MuxPlayer from "@mux/mux-player-react";

import { Header } from "@/components/Header";
import { CookbookGrid } from "@/components/cookbook/CookbookGrid";
import { BillingModal } from "@/components/billing/BillingModal";

export function HomeClient() {
  const searchParams = useSearchParams();
  const [billingOpen, setBillingOpen] = useState(searchParams.get("billing") === "1");

  const { isLoaded, user } = useUser();

  // Clear the "clicked message button" flag when user becomes authenticated
  useEffect(() => {
    if (isLoaded && user) {
      localStorage.removeItem("appitito_clicked_message_button");
    }
  }, [isLoaded, user]);

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
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [showControls, setShowControls] = useState(false);
  const { openSignIn } = useClerk();

  useEffect(() => {
    document.body.style.overflow = "hidden";

    // Check if user has already watched the video before
    const hasWatchedVideo = localStorage.getItem("appitito_watched_video");
    // Check if user has clicked the message button before
    const hasClickedButton = localStorage.getItem("appitito_clicked_message_button");

    if (hasWatchedVideo === "true" || hasClickedButton === "true") {
      setButtonEnabled(true);
      setTimeRemaining(0);
    }

    // If user has clicked the button before, immediately open sign-in modal
    if (hasClickedButton === "true") {
      openSignIn();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [openSignIn]);

  const handleTimeUpdate = (e: any) => {
    const video = e.target;
    if (!video) return;

    const elapsed = Math.floor(video.currentTime || 0);

    if (elapsed >= 15) {
      setButtonEnabled(true);
    } else {
      setTimeRemaining(15 - elapsed);
    }
  };

  const handleVideoClick = () => {
    setShowControls(true);
  };

  return (
    <main
      className="flex h-screen flex-col items-center justify-center px-4 overflow-hidden"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div
        className="w-full max-w-md rounded-[2rem] border px-6 py-6 text-center shadow-[0_18px_50px_var(--shadow-warm)]"
        style={{ backgroundColor: "var(--panel)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mouse.webp" alt="Appitito" className="w-8 h-8 rounded-full object-cover" />
          <p className="text-xs uppercase tracking-[0.28em]" style={{ color: "var(--ink-muted)" }}>
            Appitito
          </p>
        </div>

        {/* Video placeholder - replace src with your screen recording */}
        <div
          className="mt-4 overflow-hidden rounded-2xl bg-black mx-auto"
          style={{ aspectRatio: "9 / 16", maxHeight: "55vh", cursor: showControls ? "default" : "pointer" }}
          onClick={handleVideoClick}
        >
          <MuxPlayer
            playbackId="L54cq8RcXDgl1ErbkkuCvqD7FYsp6V005G9grDbt2zqU"
            streamType="on-demand"
            autoPlay="muted"
            loop
            muted
            playsInline
            nohotkeys
            thumbnailTime={30}
            className="w-full h-full"
            style={
              showControls ? {
                objectFit: "cover",
                aspectRatio: "9 / 16",
                "--seek-backward-button": "none",
                "--seek-forward-button": "none",
                "--mute-button": "none",
                "--volume-range": "none",
                "--time-display": "none",
                "--duration-display": "none",
                "--fullscreen-button": "none",
                "--captions-button": "none",
                "--airplay-button": "none",
                "--pip-button": "none",
                "--cast-button": "none",
                "--playback-rate-button": "none"
              } as any : {
                objectFit: "cover",
                aspectRatio: "9 / 16",
                "--controls": "none"
              } as any
            }
            onTimeUpdate={handleTimeUpdate}
          />
        </div>

        <h2 className="mt-4 font-display text-2xl leading-tight" style={{ color: "var(--ink)" }}>
          Send me a reel
        </h2>

        <div className="mt-4">
          <a
            href={buttonEnabled ? "https://urlgeni.us/instagram/28azlZ/reel" : undefined}
            onClick={(e) => {
              if (!buttonEnabled) {
                e.preventDefault();
              } else {
                // Save flags when user clicks the button
                localStorage.setItem("appitito_watched_video", "true");
                localStorage.setItem("appitito_clicked_message_button", "true");
              }
            }}
            className="inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-semibold transition-opacity"
            style={{
              backgroundColor: "var(--accent)",
              color: "#fff",
              opacity: buttonEnabled ? 1 : 0.5,
              cursor: buttonEnabled ? "pointer" : "not-allowed"
            }}
          >
            {buttonEnabled ? "Message @appitito" : `Watch video (${timeRemaining}s)`}
          </a>
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
        <div className="flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mouse.webp" alt="Appitito" className="w-8 h-8 rounded-full object-cover" />
          <p className="text-xs uppercase tracking-[0.28em]" style={{ color: "var(--ink-muted)" }}>
            Appitito
          </p>
        </div>
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
