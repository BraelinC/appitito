"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft } from "lucide-react";

import { UserRecipe, COOKBOOK_CATEGORIES, isUserRecipe } from "@/lib/types";
import { formatTotalTime } from "@/lib/time";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";
import { RecipeHeader } from "./RecipeHeader";
import { RecipeHero } from "./RecipeHero";
import { RecipeMetaStrip } from "./RecipeMetaStrip";
import { RecipeTabs } from "./RecipeTabs";

interface Props {
  /** Pre-validated recipe ID */
  id: string;
}

/**
 * Main recipe detail page component.
 * Handles loading/error states and orchestrates sub-components.
 */
export function RecipeDetailClient({ id }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const [showSaveSheet, setShowSaveSheet] = useState(false);

  // Fetch recipe data
  const rawRecipe = useQuery(
    api.recipes.userRecipes.getUserRecipeById,
    user?.id ? { recipeId: id as Id<"userRecipes"> } : "skip"
  );

  // Validate response: undefined = loading, null = not found, UserRecipe = loaded
  const recipe: UserRecipe | null | undefined = 
    rawRecipe === undefined ? undefined :
    rawRecipe === null ? null :
    isUserRecipe(rawRecipe) ? rawRecipe : null;

  const toggleFavorite = useMutation(api.recipes.userRecipes.toggleRecipeFavorite);

  async function handleFavorite() {
    if (!user || !recipe) return;
    try {
      await toggleFavorite({ userId: user.id, userRecipeId: recipe._id });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }

  // ── Loading state ───────────────────────────────────────────
  if (recipe === undefined) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--cream)" }}>
        <div
          className="sticky top-0 z-30 flex items-center gap-3 px-4 py-4 border-b"
          style={{ backgroundColor: "var(--cream)", borderColor: "var(--line)" }}
        >
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-60"
          >
            <ArrowLeft size={20} style={{ color: "var(--ink)" }} />
          </button>
        </div>
        <div className="px-5 pt-6 space-y-4">
          <Skeleton variant="hero" />
          <Skeleton variant="text" className="w-3/4 h-7" />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      </div>
    );
  }

  // ── Not found state ─────────────────────────────────────────
  if (recipe === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ backgroundColor: "var(--cream)" }}>
        <EmptyState
          icon="🍽️"
          title="Recipe not found"
          description="This recipe doesn't exist or has been removed."
        />
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 mt-4"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Go back
        </button>
      </div>
    );
  }

  // ── Loaded state ────────────────────────────────────────────
  const catMeta = recipe.cookbookCategory
    ? COOKBOOK_CATEGORIES.find((c) => c.id === recipe.cookbookCategory)
    : null;

  const totalTime = formatTotalTime(recipe.prep_time, recipe.cook_time);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--cream)" }}>
      <RecipeHeader
        recipe={recipe}
        onBack={() => router.back()}
        onFavorite={handleFavorite}
        onSave={() => setShowSaveSheet(true)}
      />

      <RecipeHero
        imageUrl={recipe.imageUrl}
        instagramReelShortcode={recipe.instagramReelShortcode}
        title={recipe.title}
        fallbackEmoji={catMeta?.emoji}
      />

      {/* Content */}
      <div className={`flex-1 px-5 relative z-10 ${recipe.instagramReelShortcode ? "" : "-mt-4"}`}>
        {/* Title & description */}
        <div className="mb-4">
          <h1
            className="font-display text-2xl font-bold leading-snug"
            style={{ color: "var(--ink)" }}
          >
            {recipe.title}
          </h1>
          {recipe.description && (
            <p
              className="text-sm mt-2 leading-relaxed"
              style={{ color: "var(--ink-secondary)" }}
            >
              {recipe.description}
            </p>
          )}
        </div>

        <RecipeMetaStrip
          totalTime={totalTime}
          servings={recipe.servings}
          cuisine={recipe.cuisine}
          diet={recipe.diet}
        />

        <RecipeTabs
          ingredients={recipe.ingredients}
          instructions={recipe.instructions}
        />
      </div>

      {/* Save to cookbook sheet */}
      {showSaveSheet && (
        <CookbookSelectionSheet
          open={showSaveSheet}
          onClose={() => setShowSaveSheet(false)}
          recipe={recipe}
        />
      )}
    </div>
  );
}
