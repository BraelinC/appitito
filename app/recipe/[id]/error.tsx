"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RecipeError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error("Recipe page error:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 px-5"
      style={{ backgroundColor: "var(--cream)" }}
    >
      <span className="text-6xl">🍽️</span>
      <h1
        className="font-display text-2xl font-bold text-center"
        style={{ color: "var(--ink)" }}
      >
        Couldn&apos;t load recipe
      </h1>
      <p
        className="text-sm text-center max-w-xs"
        style={{ color: "var(--ink-secondary)" }}
      >
        This recipe may have been removed or there was a connection issue.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-full text-sm font-semibold border transition-colors hover:bg-[var(--cream-warm)]"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          Go back
        </button>
        <button
          onClick={reset}
          className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
