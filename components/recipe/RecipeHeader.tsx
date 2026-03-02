"use client";

import { ArrowLeft, Heart, BookmarkPlus } from "lucide-react";
import { UserRecipe, getRecipeTitle } from "@/lib/types";

interface RecipeHeaderProps {
  recipe: UserRecipe;
  onBack: () => void;
  onFavorite: () => void;
  onSave: () => void;
}

/**
 * Sticky header bar for recipe detail page.
 * Shows title, back button, favorite and save buttons.
 */
export function RecipeHeader({ recipe, onBack, onFavorite, onSave }: RecipeHeaderProps) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b"
      style={{ backgroundColor: "var(--cream)", borderColor: "var(--line)" }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className="w-9 h-9 flex items-center justify-center transition-opacity hover:opacity-60 shrink-0"
        aria-label="Go back"
      >
        <ArrowLeft size={20} style={{ color: "var(--ink)" }} />
      </button>

      {/* Title */}
      <p
        className="font-display font-semibold text-sm truncate flex-1 text-center"
        style={{ color: "var(--ink)" }}
      >
        {getRecipeTitle(recipe)}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Favorite button */}
        <button
          onClick={onFavorite}
          className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors hover:opacity-80"
          style={{ 
            borderColor: recipe.isFavorited ? "var(--accent)" : "var(--ink)", 
            backgroundColor: recipe.isFavorited ? "var(--accent)" : "var(--cream)" 
          }}
          title={recipe.isFavorited ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={recipe.isFavorited}
        >
          <Heart
            size={16}
            style={{
              color: recipe.isFavorited ? "#fff" : "var(--ink)",
              fill: recipe.isFavorited ? "#fff" : "transparent",
            }}
          />
        </button>

        {/* Save to cookbook button */}
        <button
          onClick={onSave}
          className="w-9 h-9 rounded-full flex items-center justify-center border transition-colors hover:opacity-80"
          style={{ 
            borderColor: recipe.cookbookCategory ? "var(--accent)" : "var(--ink)", 
            backgroundColor: recipe.cookbookCategory ? "var(--accent)" : "var(--cream)" 
          }}
          title="Save to cookbook"
          aria-pressed={!!recipe.cookbookCategory}
        >
          <BookmarkPlus size={16} style={{ color: recipe.cookbookCategory ? "#fff" : "var(--ink)" }} />
        </button>
      </div>
    </div>
  );
}
