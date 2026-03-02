/**
 * Shared types for Appetito web app
 * These mirror the Convex schema shapes returned by queries.
 */

import type { Id } from "@/convex/_generated/dataModel";

// ── Type Guards ────────────────────────────────────────────────

/**
 * Helper to safely check if value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Type guard to check if a value is a valid CookbookStat
 * Validates all required fields and their types
 */
export function isCookbookStat(value: unknown): value is CookbookStat {
  if (!isObject(value)) return false;
  
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.recipeCount === "number" &&
    Array.isArray(value.recipeImages) &&
    value.recipeImages.every((img) => typeof img === "string")
  );
}

/**
 * Type guard to check if a value is a valid CookbookStat array
 * Validates each item has correct structure and types
 */
export function isCookbookStatArray(value: unknown): value is CookbookStat[] {
  return Array.isArray(value) && value.every(isCookbookStat);
}

/**
 * Type guard to check if a value is a valid UserRecipe
 * Validates required fields and their types
 */
export function isUserRecipe(value: unknown): value is UserRecipe {
  if (!isObject(value)) return false;

  // Check required fields with correct types
  const hasRequiredFields =
    typeof value._id === "string" &&
    typeof value.userId === "string" &&
    typeof value.recipeType === "string" &&
    ["extracted", "community", "custom", "ai_generated"].includes(value.recipeType as string) &&
    typeof value.isFavorited === "boolean" &&
    typeof value.createdAt === "number" &&
    typeof value.updatedAt === "number";

  if (!hasRequiredFields) return false;

  // Check optional fields have correct types when present
  const optionalStringFields = [
    "description", "imageUrl", "servings", "prep_time", "cook_time",
    "cuisine", "diet", "category", "cookbookCategory",
    "muxPlaybackId", "muxAssetId", "instagramReelShortcode",
    "extractedRecipeId", "communityRecipeId"
  ];

  for (const field of optionalStringFields) {
    if (field in value && value[field] !== undefined && typeof value[field] !== "string") {
      return false;
    }
  }

  if ("time_minutes" in value && value.time_minutes !== undefined && typeof value.time_minutes !== "number") {
    return false;
  }

  return true;
}

/**
 * Type guard to check if a value is a valid UserRecipe array
 * Validates each item has correct structure and types
 */
export function isUserRecipeArray(value: unknown): value is UserRecipe[] {
  return Array.isArray(value) && value.every(isUserRecipe);
}

// ── Interfaces ─────────────────────────────────────────────────

export interface CookbookStat {
  id: string;       // e.g. "breakfast"
  name: string;     // e.g. "Breakfast"
  recipeCount: number;
  recipeImages: string[];
}

export interface UserRecipe {
  _id: Id<"userRecipes">;
  userId: string;
  recipeType: "extracted" | "community" | "custom" | "ai_generated";

  // Core fields (may be in customRecipeData for some records)
  title?: string;
  description?: string;
  imageUrl?: string;
  ingredients?: string[];
  instructions?: string[];

  servings?: string;
  prep_time?: string;
  cook_time?: string;
  time_minutes?: number;
  cuisine?: string;
  diet?: string;
  category?: string;

  cookbookCategory?: string;
  isFavorited: boolean;

  // Video
  muxPlaybackId?: string;
  muxAssetId?: string;
  instagramReelShortcode?: string;

  // Source references (for save flow)
  extractedRecipeId?: Id<"extractedRecipes">;
  communityRecipeId?: Id<"recipes">;

  // Cached/fallback fields
  cachedTitle?: string;
  cachedImageUrl?: string;
  customRecipeData?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    ingredients?: string[];
    instructions?: string[];
    servings?: string;
    prep_time?: string;
    cook_time?: string;
    cuisine?: string;
  };

  createdAt: number;
  updatedAt: number;
}

/**
 * Helper to get the display title from a UserRecipe
 * (handles customRecipeData and cachedTitle fallbacks)
 */
export function getRecipeTitle(recipe: UserRecipe): string {
  return recipe.title ?? recipe.cachedTitle ?? recipe.customRecipeData?.title ?? "Untitled Recipe";
}

/**
 * Helper to get ingredients from a UserRecipe
 */
export function getRecipeIngredients(recipe: UserRecipe): string[] {
  return recipe.ingredients ?? recipe.customRecipeData?.ingredients ?? [];
}

/**
 * Helper to get instructions from a UserRecipe
 */
export function getRecipeInstructions(recipe: UserRecipe): string[] {
  return recipe.instructions ?? recipe.customRecipeData?.instructions ?? [];
}

export const COOKBOOK_CATEGORIES = [
  { id: "favorites", name: "Favorites",  emoji: "❤️" },
  { id: "breakfast", name: "Breakfast",  emoji: "🥞" },
  { id: "lunch",     name: "Lunch",      emoji: "🥪" },
  { id: "dinner",    name: "Dinner",     emoji: "🍝" },
  { id: "dessert",   name: "Dessert",    emoji: "🍰" },
  { id: "snacks",    name: "Snacks",     emoji: "🍎" },
] as const;

export type CookbookCategoryId = typeof COOKBOOK_CATEGORIES[number]["id"];
