"use client";
import { UserRecipe, getRecipeTitle } from "@/lib/types";

interface RecipeListItemProps {
  recipe: UserRecipe;
  emoji?: string;
  onOpen: () => void;
  onFavorite: (e: React.MouseEvent) => void;
}

/**
 * A single recipe card for use in lists/sheets.
 * Shows thumbnail, title, description, meta info, and favorite button.
 */
export function RecipeListItem({ recipe, emoji, onOpen, onFavorite }: RecipeListItemProps) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="flex items-center gap-4 rounded-2xl p-3 border text-left transition-all hover:shadow-md active:scale-[0.98] w-full cursor-pointer"
      style={{
        backgroundColor: "var(--panel)",
        borderColor: "var(--line)",
      }}
    >
      {/* Thumbnail */}
      <div
        className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
        style={{ backgroundColor: "var(--cream-warm)" }}
      >
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt={getRecipeTitle(recipe)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl">{emoji ?? "🍽️"}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="font-display font-semibold text-sm leading-tight truncate"
          style={{ color: "var(--ink)" }}
        >
          {getRecipeTitle(recipe)}
        </p>
        {recipe.description && (
          <p
            className="text-xs mt-1 line-clamp-2 leading-snug"
            style={{ color: "var(--ink-secondary)" }}
          >
            {recipe.description}
          </p>
        )}
        {/* Meta */}
        <div className="flex items-center gap-3 mt-1.5">
          {recipe.prep_time && (
            <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
              {recipe.prep_time} prep
            </span>
          )}
          {recipe.cuisine && (
            <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
              {recipe.cuisine}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
