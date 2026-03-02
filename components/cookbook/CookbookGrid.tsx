"use client";

import { useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { COOKBOOK_CATEGORIES, CookbookStat, isCookbookStatArray } from "@/lib/types";
import { CookbookSheet } from "./CookbookSheet";
import { SkeletonGrid } from "@/components/ui/Skeleton";

// ── Types ─────────────────────────────────────────────────────

interface CookbookCategoryCardProps {
  stat: CookbookStat;
  emoji: string;
  onClick: () => void;
}

// ── Category card ─────────────────────────────────────────────

function CookbookCategoryCard({ stat, emoji, onClick }: CookbookCategoryCardProps) {
  const images = stat.recipeImages.slice(0, 4);
  const hasImages = images.length > 0;

  return (
    <button
      onClick={onClick}
      aria-label={`Open ${stat.name} cookbook with ${stat.recipeCount} recipes`}
      className="group relative rounded-3xl overflow-hidden border text-left transition-all hover:-translate-y-1 hover:shadow-[0_14px_34px_var(--shadow-warm-strong)] active:scale-[0.98]"
      style={{
        backgroundColor: "var(--panel)",
        borderColor: "var(--line)",
        aspectRatio: "1 / 1",
      }}
    >
      {/* Image collage background */}
      {hasImages ? (
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: images.length > 1 ? "1fr 1fr" : "1fr" }}
        >
          {images.map((url, i) => (
            <div
              key={i}
              className="relative overflow-hidden"
              style={{ gridRow: images.length === 3 && i === 0 ? "1 / span 2" : undefined }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center text-5xl"
          style={{ backgroundColor: "var(--cream-warm)" }}
        >
          <span className="opacity-40">{emoji}</span>
        </div>
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: hasImages
            ? "linear-gradient(to top, rgba(28,25,23,0.85) 0%, rgba(28,25,23,0.2) 50%, transparent 100%)"
            : "linear-gradient(to top, rgba(28,25,23,0.6) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-lg font-semibold text-white leading-tight drop-shadow-sm">
              {stat.name}
            </p>
            <p className="text-xs text-white/70 mt-0.5">
              {stat.recipeCount === 0
                ? "No recipes yet"
                : stat.recipeCount === 1
                ? "1 recipe"
                : `${stat.recipeCount} recipes`}
            </p>
          </div>
          <span className="text-xl leading-none shrink-0" aria-hidden="true">{emoji}</span>
        </div>
      </div>
    </button>
  );
}

// ── Main grid ─────────────────────────────────────────────────

export function CookbookGrid() {
  const { user } = useUser();
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const rawStats = useQuery(
    api.recipes.userRecipes.getCookbookStats,
    user?.id ? { userId: user.id } : "skip"
  );

  // Validate and type the response
  const stats = isCookbookStatArray(rawStats) ? rawStats : undefined;

  // Memoize the stats map to avoid recreating on every render
  const statsMap = useMemo(() => {
    const map = new Map<string, CookbookStat>();
    stats?.forEach((s) => map.set(s.id, s));
    return map;
  }, [stats]);

  const isLoading = rawStats === undefined;

  return (
    <section className="flex-1 overflow-y-auto px-4 pt-8 pb-12 sm:px-6">
      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading ? (
          <SkeletonGrid count={COOKBOOK_CATEGORIES.length} />
        ) : (
          // Loaded cards
          COOKBOOK_CATEGORIES.map((cat) => {
            const stat = statsMap.get(cat.id) ?? {
              id: cat.id,
              name: cat.name,
              recipeCount: 0,
              recipeImages: [],
            };
            return (
              <CookbookCategoryCard
                key={cat.id}
                stat={stat}
                emoji={cat.emoji}
                onClick={() => setOpenCategory(cat.id)}
              />
            );
          })
        )}
      </div>

      {/* Sheet for viewing a category's recipes */}
      {openCategory && (
        <CookbookSheet
          open={!!openCategory}
          onClose={() => setOpenCategory(null)}
          categoryId={openCategory}
        />
      )}
    </section>
  );
}
