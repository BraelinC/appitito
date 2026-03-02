"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error("App error:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-5"
      style={{ backgroundColor: "var(--cream)" }}
    >
      <span className="text-6xl">😕</span>
      <h1
        className="font-display text-2xl font-bold text-center"
        style={{ color: "var(--ink)" }}
      >
        Something went wrong
      </h1>
      <p
        className="text-sm text-center max-w-xs"
        style={{ color: "var(--ink-secondary)" }}
      >
        We hit an unexpected error. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--accent)" }}
      >
        Try again
      </button>
    </div>
  );
}
