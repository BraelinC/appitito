"use client";

import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check, BookOpen } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { COOKBOOK_CATEGORIES, UserRecipe, getRecipeTitle, getRecipeIngredients, getRecipeInstructions } from "@/lib/types";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";


interface CookbookSelectionSheetProps {
  open: boolean;
  onClose: () => void;
  recipe: Pick<UserRecipe, "_id" | "title" | "description" | "imageUrl" | "ingredients" | "instructions" | "servings" | "prep_time" | "cook_time" | "cuisine" | "recipeType" | "extractedRecipeId" | "communityRecipeId" | "muxPlaybackId" | "muxAssetId" | "reelUrl" | "instagramReelShortcode">;
}

export function CookbookSelectionSheet({
  open,
  onClose,
  recipe,
}: CookbookSelectionSheetProps) {
  const { user } = useUser();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const saveRecipe = useMutation(api.recipes.userRecipes.saveRecipeToUserCookbook);

  async function handleSelect(categoryId: string) {
    if (!user || saving) return;
    setSaving(categoryId);

    try {
      await saveRecipe({
        userId: user.id,
        recipeType: recipe.recipeType as "extracted" | "community" | "custom",
        cookbookCategory: categoryId,
        title: getRecipeTitle(recipe as UserRecipe),
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        ingredients: getRecipeIngredients(recipe as UserRecipe),
        instructions: getRecipeInstructions(recipe as UserRecipe),
        servings: recipe.servings,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        cuisine: recipe.cuisine,
        // Video fields
        muxPlaybackId: recipe.muxPlaybackId,
        muxAssetId: recipe.muxAssetId,
        reelUrl: recipe.reelUrl,
        instagramReelShortcode: recipe.instagramReelShortcode,
        extractedRecipeId: recipe.extractedRecipeId,
        communityRecipeId: recipe.communityRecipeId,
      });

      setSaved(categoryId);
      closeTimeoutRef.current = setTimeout(() => {
        setSaved(null);
        onClose();
      }, 800);
    } catch (error) {
      console.error("Failed to save recipe:", error);
    } finally {
      setSaving(null);
    }
  }

  // Cleanup timeout on unmount
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay
          className="fixed inset-0 z-50"
          style={{ backgroundColor: "rgba(44, 24, 16, 0.45)", backdropFilter: "blur(4px)" }}
        />

        {/* Bottom sheet */}
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl outline-none"
          style={{ backgroundColor: "var(--cream)" }}
          aria-describedby={undefined}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div
              className="w-10 h-1 rounded-full"
              style={{ backgroundColor: "var(--ink-muted)" }}
            />
          </div>

          {/* Header */}
          <div
            className="flex items-center justify-between px-5 pb-4 border-b"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen size={18} style={{ color: "var(--accent)" }} />
              <div>
                <Dialog.Title
                  className="font-display text-lg font-bold leading-tight"
                  style={{ color: "var(--ink)" }}
                >
                  Save to cookbook
                </Dialog.Title>
                <p
                  className="text-xs mt-0.5 leading-snug max-w-[220px] truncate"
                  style={{ color: "var(--ink-secondary)" }}
                >
                  {getRecipeTitle(recipe as UserRecipe)}
                </p>
              </div>
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

          {/* Category grid */}
          <div className="px-5 py-5 grid grid-cols-3 gap-3 pb-8">
            {COOKBOOK_CATEGORIES.map((cat) => {
              const isSaving = saving === cat.id;
              const isSaved = saved === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleSelect(cat.id)}
                  disabled={!!saving}
                  className="relative flex flex-col items-center gap-2 rounded-2xl py-5 px-2 border-2 transition-all active:scale-95 disabled:opacity-60"
                  style={{
                    backgroundColor: isSaved
                      ? "var(--sage)"
                      : isSaving
                      ? "var(--cream-warm)"
                      : "var(--panel)",
                    borderColor: isSaved
                      ? "var(--sage)"
                      : isSaving
                      ? "var(--accent)"
                      : "var(--line)",
                  }}
                >
                  {isSaved ? (
                    <>
                      <Check size={24} color="#fff" />
                      <span className="text-xs font-semibold text-white">Saved!</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl leading-none">{cat.emoji}</span>
                      <span
                        className="text-xs font-semibold text-center leading-tight"
                        style={{ color: "var(--ink-secondary)" }}
                      >
                        {cat.name}
                      </span>
                    </>
                  )}

                  {/* Loading spinner */}
                  {isSaving && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Spinner size={24} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Safe area padding for mobile */}
          <div style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
