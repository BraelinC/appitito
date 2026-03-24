"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, BookmarkPlus, Heart, ShoppingCart, Loader2 } from "lucide-react";

import { UserRecipe, COOKBOOK_CATEGORIES, isUserRecipe, getRecipeTitle, getRecipeIngredients, getRecipeInstructions } from "@/lib/types";
import { formatTotalTime } from "@/lib/time";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";
import { RecipeHeader } from "./RecipeHeader";
import { RecipeHero } from "./RecipeHero";
import { RecipeMetaStrip } from "./RecipeMetaStrip";
import { RecipeTabs } from "./RecipeTabs";
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
  useDmTokenSignIn();
  const createShoppingCart = useAction(api.instacart.createShoppingCart);

  // Fetch recipe data
  const rawRecipe = useQuery(api.recipes.userRecipes.getUserRecipeById, { recipeId: id });

  // Validate response: undefined = loading, null = not found, UserRecipe = loaded
  const recipe: UserRecipe | null | undefined = 
    rawRecipe === undefined ? undefined :
    rawRecipe === null ? null :
    isUserRecipe(rawRecipe) ? rawRecipe : null;

  const toggleFavorite = useMutation(api.recipes.userRecipes.toggleRecipeFavorite);
  const canManageRecipe = !!user && recipe?.userId === user.id;

  async function handleFavorite() {
    if (!recipe) return;
    if (!canManageRecipe) {
      openSignIn();
      return;
    }

    try {
      await toggleFavorite({ userId: user.id, userRecipeId: recipe._id });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }

  function handleSave() {
    if (!user) {
      openSignIn();
      return;
    }

    setShowSaveSheet(true);
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
        onFavorite={handleFavorite}
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
          <RecipeActionCluster
            isFavorited={recipe.isFavorited}
            isSaved={!!recipe.cookbookCategory}
            onFavorite={handleFavorite}
            onSave={handleSave}
            onCart={handleCart}
            cartLoading={cartLoading}
            side="right"
          >
            {recipe.description && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--ink-secondary)" }}
              >
                {recipe.description}
              </p>
            )}
          </RecipeActionCluster>
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

interface RecipeActionClusterProps {
  isFavorited: boolean;
  isSaved: boolean;
  onFavorite: () => void;
  onSave: () => void;
  onCart: () => void;
  cartLoading?: boolean;
  children?: React.ReactNode;
  side?: "left" | "right";
}

function RecipeActionCluster({ isFavorited, isSaved, onFavorite, onSave, onCart, cartLoading, children, side = "left" }: RecipeActionClusterProps) {
  const [expanded, setExpanded] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggeredRef = useRef(false);
  const expandedAtRef = useRef<number>(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triangleSide = 68;
  const triangleHeight = triangleSide * 0.866;
  const trianglePositions = {
    heart: { x: -triangleSide / 2, y: -triangleHeight / 2 },
    bookmark: { x: triangleSide / 2, y: -triangleHeight / 2 },
    cart: { x: 0, y: triangleHeight / 2 },
  };

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!expanded) {
        return;
      }

      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, [expanded]);

  function startHold() {
    holdTriggeredRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }

    holdTimerRef.current = setTimeout(() => {
      holdTriggeredRef.current = true;
      expandedAtRef.current = Date.now();
      setExpanded(true);
    }, 260);
  }

  function clearHold() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function handleBookmarkPress() {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }

    onSave();
  }

  function handleClusterAction(action: () => void) {
    // Ignore clicks within 300ms of expansion to prevent accidental taps
    if (Date.now() - expandedAtRef.current < 300) {
      return;
    }
    action();
    setExpanded(false);
  }

  return (
    <div className={`flex min-w-0 items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      <div className={`relative shrink-0 transition-all duration-200 ${expanded ? "h-[148px] w-[148px]" : "h-[72px] w-[72px]"}`}>
        <div ref={rootRef} className="absolute inset-0">
        <button
          onMouseDown={startHold}
          onMouseUp={() => {
            clearHold();
            handleBookmarkPress();
          }}
          onMouseLeave={clearHold}
          onTouchStart={startHold}
          onTouchEnd={() => {
            clearHold();
            handleBookmarkPress();
          }}
          onContextMenu={(event) => event.preventDefault()}
          className={`absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${expanded ? "scale-75 opacity-0 pointer-events-none" : "scale-100 opacity-100"}`}
          style={{
            width: 64,
            height: 64,
            color: isSaved ? "var(--accent)" : "var(--ink)",
          }}
          title="Save to cookbook"
          aria-pressed={isSaved}
        >
          <BookmarkPlus size={34} strokeWidth={1.85} />
        </button>

        <div className={`absolute inset-0 ${expanded ? "pointer-events-auto" : "pointer-events-none"}`}>
        <ActionBubble
          className="left-1/2 top-1/2"
          active={isFavorited}
          label="Add to favourites"
          onClick={() => handleClusterAction(onFavorite)}
          expanded={expanded}
          transformWhenClosed="translate(-50%, -50%) scale(0.35)"
          transformWhenOpen={`translate(calc(-50% + ${trianglePositions.heart.x}px), calc(-50% + ${trianglePositions.heart.y}px)) scale(1)`}
          delayMs={0}
        >
          <Heart
            size={20}
            style={{
              color: isFavorited ? "#fff" : "var(--ink)",
              fill: isFavorited ? "#fff" : "transparent",
            }}
          />
        </ActionBubble>

        <ActionBubble
          className="left-1/2 top-1/2"
          active={isSaved}
          label="Save to cookbook"
          onClick={() => handleClusterAction(onSave)}
          expanded={expanded}
          transformWhenClosed="translate(-50%, -50%) scale(0.35)"
          transformWhenOpen={`translate(calc(-50% + ${trianglePositions.bookmark.x}px), calc(-50% + ${trianglePositions.bookmark.y}px)) scale(1)`}
          delayMs={35}
        >
          <BookmarkPlus size={20} style={{ color: isSaved ? "#fff" : "var(--ink)" }} />
        </ActionBubble>

        <ActionBubble
          className="left-1/2 top-1/2"
          active={false}
          label="Open grocery cart"
          onClick={() => handleClusterAction(onCart)}
          expanded={expanded}
          transformWhenClosed="translate(-50%, -50%) scale(0.32)"
          transformWhenOpen={`translate(calc(-50% + ${trianglePositions.cart.x}px), calc(-50% + ${trianglePositions.cart.y}px)) scale(1)`}
          delayMs={70}
        >
          {cartLoading ? (
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--ink)" }} />
          ) : (
            <ShoppingCart size={20} style={{ color: "var(--ink)" }} />
          )}
        </ActionBubble>
        </div>
        </div>
      </div>

      <div className="w-px self-stretch" style={{ backgroundColor: "var(--line)" }} />

      <div className="min-w-0 flex-1 py-1 transition-all duration-200">
        {children}
      </div>
    </div>
  );
}

interface ActionBubbleProps {
  children: React.ReactNode;
  className: string;
  active: boolean;
  label: string;
  onClick: () => void;
  expanded: boolean;
  transformWhenClosed: string;
  transformWhenOpen: string;
  delayMs?: number;
}

function ActionBubble({ children, className, active, label, onClick, expanded, transformWhenClosed, transformWhenOpen, delayMs = 0 }: ActionBubbleProps) {
  return (
    <button
      onClick={onClick}
      className={`absolute flex h-12 w-12 items-center justify-center rounded-full border shadow-[0_10px_24px_var(--shadow-warm)] ${className}`}
      style={{
        borderColor: active ? "var(--accent)" : "var(--ink)",
        backgroundColor: active ? "var(--accent)" : "var(--cream)",
        opacity: expanded ? 1 : 0,
        transform: expanded ? transformWhenOpen : transformWhenClosed,
        transitionProperty: "transform, opacity",
        transitionDuration: expanded ? "320ms" : "200ms",
        transitionTimingFunction: expanded ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-in",
        transitionDelay: expanded ? `${delayMs}ms` : "0ms",
      }}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
