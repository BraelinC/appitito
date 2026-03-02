"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { SkeletonList } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RecipeListItem } from "./RecipeListItem";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { COOKBOOK_CATEGORIES, UserRecipe, isUserRecipeArray } from "@/lib/types";
import { useRouter } from "next/navigation";

interface CookbookSheetProps {
  open: boolean;
  onClose: () => void;
  categoryId: string;
}

export function CookbookSheet({ open, onClose, categoryId }: CookbookSheetProps) {
  const { user } = useUser();
  const router = useRouter();

  const catMeta = COOKBOOK_CATEGORIES.find((c) => c.id === categoryId);

  const rawRecipes = useQuery(
    api.recipes.userRecipes.getUserRecipesByCookbook,
    open && user?.id ? { userId: user.id, cookbookCategory: categoryId } : "skip"
  );

  // Validate and type the response
  const recipes = isUserRecipeArray(rawRecipes) ? rawRecipes : undefined;

  const toggleFavorite = useMutation(api.recipes.userRecipes.toggleRecipeFavorite);

  async function handleFavorite(e: React.MouseEvent, recipe: UserRecipe) {
    e.stopPropagation();
    if (!user) return;
    try {
      await toggleFavorite({ userId: user.id, userRecipeId: recipe._id });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  }

  function handleOpenRecipe(recipe: UserRecipe) {
    router.push(`/recipe/${recipe._id}`);
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ backgroundColor: "rgba(44, 24, 16, 0.45)", backdropFilter: "blur(4px)" }}
        />

        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl outline-none flex flex-col"
          style={{
            backgroundColor: "var(--cream)",
            maxHeight: "88vh",
          }}
          aria-describedby={undefined}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--ink-muted)" }} />
          </div>

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b shrink-0"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-2xl leading-none">{catMeta?.emoji}</span>
              <Dialog.Title
                className="font-display text-xl font-bold"
                style={{ color: "var(--ink)" }}
              >
                {catMeta?.name}
              </Dialog.Title>
              {recipes !== undefined && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: "var(--cream-warm)",
                    color: "var(--ink-secondary)",
                  }}
                >
                  {recipes.length}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--cream-warm)]"
              style={{ color: "var(--ink-secondary)" }}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Recipe list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 pb-10">
            {/* Loading */}
            {recipes === undefined && <SkeletonList count={4} />}

            {/* Empty state */}
            {recipes !== undefined && recipes.length === 0 && (
              <EmptyState
                icon="🍽️"
                title="No recipes yet"
                description={`Save recipes to your ${catMeta?.name} cookbook to see them here.`}
              />
            )}

            {/* Recipe cards */}
            {recipes && recipes.length > 0 && (
              <div className="flex flex-col gap-3">
                {recipes.map((recipe) => (
                  <RecipeListItem
                    key={recipe._id}
                    recipe={recipe}
                    emoji={catMeta?.emoji}
                    onOpen={() => handleOpenRecipe(recipe)}
                    onFavorite={(e) => handleFavorite(e, recipe)}
                  />
                ))}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
