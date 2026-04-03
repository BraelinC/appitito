"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Loader2 } from "lucide-react";

import { UserRecipe, COOKBOOK_CATEGORIES, isUserRecipe, getRecipeTitle, getRecipeIngredients, getRecipeInstructions } from "@/lib/types";
import { formatTotalTime } from "@/lib/time";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";
import { RecipeHeader } from "./RecipeHeader";
import { RecipeHero } from "./RecipeHero";
import { RecipeMetaStrip } from "./RecipeMetaStrip";
import { RecipeTabs } from "./RecipeTabs";
import { RecipeActionButtons } from "./RecipeActionButtons";
import { useDmTokenSignIn } from "@/components/auth/useDmTokenSignIn";

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
  const { openSignIn } = useClerk();
  const { user } = useUser();
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  useDmTokenSignIn();
  const createShoppingCart = useAction(api.instacart.createShoppingCart);

  // Check if user should see Instacart tip (shows on 2nd recipe)
  const tipStatus = useQuery(
    api.instagramAuth.getInstacartTipStatus,
    user?.id ? { clerkUserId: user.id } : "skip"
  );
  const markTipSeen = useMutation(api.instagramAuth.markInstacartTipSeen);

  const showInstacartTip = tipStatus?.showTip === true && !tipDismissed;

  async function handleDismissTip() {
    setTipDismissed(true);
    if (user?.id) {
      await markTipSeen({ clerkUserId: user.id });
    }
  }

  // Fetch recipe data
  const rawRecipe = useQuery(api.recipes.userRecipes.getUserRecipeById, { recipeId: id });

  // Validate response: undefined = loading, null = not found, UserRecipe = loaded
  const recipe: UserRecipe | null | undefined = 
    rawRecipe === undefined ? undefined :
    rawRecipe === null ? null :
    isUserRecipe(rawRecipe) ? rawRecipe : null;

  const saveToFavorites = useMutation(api.recipes.userRecipes.saveRecipeToUserCookbook);

  async function handleSave() {
    if (!user) {
      openSignIn();
      return;
    }

    if (!recipe) return;

    // If already saved, show sheet to pick different category
    if (recipe.cookbookCategory || recipe.isFavorited) {
      setShowSaveSheet(true);
      return;
    }

    // First save -> auto-save to favorites
    try {
      await saveToFavorites({
        userId: user.id,
        recipeType: recipe.recipeType,
        cookbookCategory: "favorites",
        title: getRecipeTitle(recipe),
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        ingredients: getRecipeIngredients(recipe),
        instructions: getRecipeInstructions(recipe),
        servings: recipe.servings,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        cuisine: recipe.cuisine,
        muxPlaybackId: recipe.muxPlaybackId,
        muxAssetId: recipe.muxAssetId,
        reelUrl: recipe.reelUrl,
        instagramReelShortcode: recipe.instagramReelShortcode,
        extractedRecipeId: recipe.extractedRecipeId,
        communityRecipeId: recipe.communityRecipeId,
      });
    } catch (error) {
      console.error("Failed to save recipe:", error);
    }
  }

  async function handleCart() {
    if (!recipe || cartLoading) return;

    const ingredients = getRecipeIngredients(recipe);
    if (ingredients.length === 0) {
      console.error("No ingredients to add to cart");
      return;
    }

    setCartLoading(true);
    try {
      const result = await createShoppingCart({
        recipeTitle: getRecipeTitle(recipe),
        ingredients,
        imageUrl: recipe.imageUrl,
        servings: recipe.servings ? parseInt(recipe.servings, 10) : undefined,
      });

      if (result.shoppingUrl) {
        // Redirect to Instacart
        window.location.href = result.shoppingUrl;
      }
    } catch (error) {
      console.error("Failed to create shopping cart:", error);
      setCartLoading(false);
    }
    // Don't reset loading state on success - we're redirecting
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
        onBack={() => router.push("/")}
        onFavorite={() => {}}
        onSave={handleSave}
        showActions={false}
      />

      <RecipeHero
        imageUrl={recipe.imageUrl}
        muxPlaybackId={recipe.muxPlaybackId}
        reelUrl={recipe.reelUrl}
        title={getRecipeTitle(recipe)}
        fallbackEmoji={catMeta?.emoji}
      />

      {/* Content */}
      <div className={`flex-1 px-5 relative z-10 ${recipe.muxPlaybackId || recipe.reelUrl ? "" : "-mt-4"}`}>
        <div className="mb-4 flex items-center gap-3">
          <RecipeActionButtons
            isSaved={recipe.isFavorited || !!recipe.cookbookCategory}
            onSave={handleSave}
            onCart={handleCart}
            cartLoading={cartLoading}
            side="right"
            showInstacartTip={showInstacartTip}
            onDismissTip={handleDismissTip}
          >
            {recipe.description && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--ink-secondary)" }}
              >
                {recipe.description}
              </p>
            )}
          </RecipeActionButtons>
        </div>

        <RecipeMetaStrip
          totalTime={totalTime}
          servings={recipe.servings}
          cuisine={recipe.cuisine}
        />

        <RecipeTabs
          ingredients={getRecipeIngredients(recipe)}
          instructions={getRecipeInstructions(recipe)}
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

      {/* Instacart loading overlay */}
      {cartLoading && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
          style={{ backgroundColor: "rgba(44, 24, 16, 0.85)", backdropFilter: "blur(8px)" }}
        >
          <Loader2 size={48} className="animate-spin" style={{ color: "var(--cream)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--cream)" }}>
            Preparing your shopping cart...
          </p>
          <p className="text-sm" style={{ color: "var(--cream)", opacity: 0.7 }}>
            Redirecting to Instacart
          </p>
        </div>
      )}
    </div>
  );
}

