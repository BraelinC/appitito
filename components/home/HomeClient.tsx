"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Header } from "@/components/Header";
import { CookbookGrid } from "@/components/cookbook/CookbookGrid";

export function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const claimed = searchParams.get("claimed") === "1";

  useEffect(() => {
    if (claimed) {
      const timeout = window.setTimeout(() => {
        router.replace("/");
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [claimed, router]);

  return (
    <main className="min-h-screen">
      <Header />
      <CookbookGrid />
      {claimed ? <OnboardingState /> : null}
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
